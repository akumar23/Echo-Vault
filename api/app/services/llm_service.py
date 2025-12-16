"""
LLM Service using OpenAI-compatible API format.

This service supports any LLM provider that implements the OpenAI API standard:
- Ollama (via /v1/chat/completions and /v1/embeddings)
- OpenAI
- LM Studio
- vLLM
- Together.ai
- Groq
- And many others

The service uses the chat completions format for text generation and the
embeddings endpoint for vector generation.
"""
import httpx
import json
import re
import logging
import os
from typing import List, Optional, Dict, Any

from app.core.config import settings as app_settings


class LLMService:
    """
    Service for interacting with OpenAI-compatible LLM APIs.

    Supports optional Bearer token authentication for cloud providers.
    Caches prompt templates loaded from disk at initialization.
    """

    def __init__(
        self,
        base_url: str,
        model: str,
        api_token: Optional[str] = None,
        service_type: str = "generation"  # "generation" or "embedding"
    ):
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.api_token = api_token
        self.service_type = service_type
        self._client: Optional[httpx.AsyncClient] = None
        self._logger = logging.getLogger(__name__)

        # Cache prompt templates at initialization (only for generation service)
        self._prompts: Dict[str, str] = {}
        if service_type == "generation":
            self._prompts = self._load_prompts()

    def _load_prompts(self) -> Dict[str, str]:
        """Load all prompt templates from disk once at initialization."""
        prompts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "prompts")
        prompt_files = {
            "reflection": "reflection.txt",
            "mood_infer": "mood_infer.txt",
            "topic_labels": "topic_labels.txt"
        }

        prompts = {}
        for name, filename in prompt_files.items():
            prompt_path = os.path.join(prompts_dir, filename)
            try:
                with open(prompt_path, "r") as f:
                    prompts[name] = f.read()
                self._logger.debug(f"Loaded prompt template: {name}")
            except FileNotFoundError:
                self._logger.warning(f"Prompt template not found: {prompt_path}")
                prompts[name] = ""
            except Exception as e:
                self._logger.error(f"Error loading prompt template {name}: {e}")
                prompts[name] = ""

        return prompts

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create the shared httpx.AsyncClient."""
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            if self.api_token:
                headers["Authorization"] = f"Bearer {self.api_token}"

            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                headers=headers
            )
            self._logger.debug(f"Created new httpx.AsyncClient for {self.base_url}")
        return self._client

    async def close(self):
        """Close the shared httpx client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._logger.debug("Closed httpx.AsyncClient")

    async def get_embedding(self, text: str) -> List[float]:
        """
        Get embedding vector using OpenAI-compatible embeddings endpoint.

        Uses POST /v1/embeddings with {"model": "...", "input": "..."}
        """
        client = self._get_client()
        response = await client.post(
            f"{self.base_url}/v1/embeddings",
            json={"model": self.model, "input": text},
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()

        # OpenAI format returns {"data": [{"embedding": [...]}]}
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]
        # Fallback for simple format {"embedding": [...]}
        elif "embedding" in data:
            return data["embedding"]
        else:
            raise ValueError(f"Unexpected embedding response format: {data}")

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Generate text using OpenAI-compatible chat completions endpoint.

        Uses POST /v1/chat/completions with {"model": "...", "messages": [...]}
        """
        client = self._get_client()
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": False
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        response = await client.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            timeout=120.0
        )
        response.raise_for_status()
        data = response.json()

        # OpenAI format returns {"choices": [{"message": {"content": "..."}}]}
        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0]["message"]["content"]
        # Fallback for simple format {"response": "..."}
        elif "response" in data:
            return data["response"]
        else:
            raise ValueError(f"Unexpected chat completion response format: {data}")

    async def generate_reflection(self, entries_text: str) -> str:
        """Generate reflection from entries using chat completions."""
        # Split the prompt into system and user parts
        system_prompt = (
            "You are a thoughtful journaling assistant. Analyze journal entries and provide a reflection that includes:\n"
            "1. Key themes and patterns you notice\n"
            "2. Insights about the writer's emotional state and growth\n"
            "3. Two actionable suggestions for the writer\n\n"
            "Keep the reflection under 250 words, be empathetic and constructive."
        )
        user_prompt = f"Journal Entries:\n{entries_text}\n\nPlease provide your reflection:"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        return await self.chat_completion(messages, temperature=0.7)

    async def infer_mood(self, entry_content: str) -> int:
        """Infer mood (1-5) from entry content using chat completions."""
        system_prompt = (
            "You are an emotion analysis assistant. Analyze journal entries and classify them on a 1-5 mood scale.\n\n"
            "MOOD SCALE:\n"
            "1 = Very negative (despair, grief, severe anxiety, hopelessness, anger)\n"
            "2 = Somewhat negative (stress, frustration, sadness, worry, disappointment)\n"
            "3 = Neutral (factual reporting, mixed emotions, ambiguous, mundane activities)\n"
            "4 = Somewhat positive (contentment, mild happiness, hope, calm, gratitude)\n"
            "5 = Very positive (joy, excitement, achievement, love, euphoria)\n\n"
            "INSTRUCTIONS:\n"
            "- Respond ONLY with valid JSON: {\"mood\": <number>, \"confidence\": \"<high|medium|low>\"}\n"
            "- The mood must be an integer from 1 to 5\n"
            "- Do NOT include explanations or any text outside the JSON"
        )
        user_prompt = f"Analyze this journal entry:\n\n{entry_content}\n\nOutput (JSON only):"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response_text = await self.chat_completion(messages, temperature=0.3)
        return self._parse_mood_response(response_text)

    def _parse_mood_response(self, response_text: str) -> int:
        """Parse mood from LLM response with multiple fallback strategies."""
        mood = None
        confidence = "low"

        # Strategy 1: Try JSON parsing (primary method)
        try:
            json_match = re.search(r'\{[^}]+\}', response_text)
            if json_match:
                parsed = json.loads(json_match.group())
                mood = int(parsed.get("mood", 3))
                confidence = parsed.get("confidence", "low")
        except (json.JSONDecodeError, ValueError, AttributeError):
            pass

        # Strategy 2: Try extracting first integer in range 1-5
        if mood is None:
            try:
                numbers = re.findall(r'\b([1-5])\b', response_text)
                if numbers:
                    mood = int(numbers[0])
                    confidence = "low"
            except (ValueError, IndexError):
                pass

        # Strategy 3: Try word-to-number mapping
        if mood is None:
            word_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
            for word, num in word_map.items():
                if word in response_text.lower():
                    mood = num
                    confidence = "low"
                    break

        # Final fallback: neutral
        if mood is None:
            mood = 3
            confidence = "low"

        # Clamp to valid range
        mood = max(1, min(5, mood))

        if confidence == "low":
            self._logger.warning(f"Low confidence mood inference. Raw response: {response_text[:100]}")

        return mood

    async def generate_insights(self, entries_summary: str) -> dict:
        """Generate insights (summary, themes, actions) from entries."""
        system_prompt = (
            "You are a thoughtful journaling assistant. Analyze journal entries and provide insights including:\n"
            "1. A brief summary of the entries\n"
            "2. Key themes and patterns\n"
            "3. Actionable suggestions for personal growth"
        )
        user_prompt = f"Journal Entries Summary:\n{entries_summary}\n\nPlease provide your insights:"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        reflection = await self.chat_completion(messages, temperature=0.7)

        return {
            "summary": reflection[:500],
            "themes": [],
            "actions": []
        }


# Service instance caches
_generation_services: Dict[str, LLMService] = {}
_embedding_services: Dict[str, LLMService] = {}


def _get_cache_key(url: str, model: str, api_token: Optional[str]) -> str:
    """Generate cache key for service instance."""
    token_hash = hash(api_token) if api_token else "none"
    return f"{url}|{model}|{token_hash}"


def get_generation_service(
    url: Optional[str] = None,
    model: Optional[str] = None,
    api_token: Optional[str] = None
) -> LLMService:
    """
    Get a generation LLM service instance.
    Uses caching to avoid creating duplicate instances.
    Falls back to environment defaults for missing parameters.
    """
    url = url or app_settings.default_generation_url
    model = model or app_settings.default_generation_model
    cache_key = _get_cache_key(url, model, api_token)

    if cache_key not in _generation_services:
        _generation_services[cache_key] = LLMService(
            base_url=url,
            model=model,
            api_token=api_token,
            service_type="generation"
        )

    return _generation_services[cache_key]


def get_embedding_service(
    url: Optional[str] = None,
    model: Optional[str] = None,
    api_token: Optional[str] = None
) -> LLMService:
    """
    Get an embedding LLM service instance.
    Uses caching to avoid creating duplicate instances.
    Falls back to environment defaults for missing parameters.
    """
    url = url or app_settings.default_embedding_url
    model = model or app_settings.default_embedding_model
    cache_key = _get_cache_key(url, model, api_token)

    if cache_key not in _embedding_services:
        _embedding_services[cache_key] = LLMService(
            base_url=url,
            model=model,
            api_token=api_token,
            service_type="embedding"
        )

    return _embedding_services[cache_key]


def get_generation_service_for_user(db, user_id: int) -> LLMService:
    """
    Get a generation LLM service for a specific user.
    Checks user settings for custom configuration.
    """
    from app.models.settings import Settings

    user_settings = db.query(Settings).filter(Settings.user_id == user_id).first()

    if user_settings:
        return get_generation_service(
            url=user_settings.generation_url,
            model=user_settings.generation_model,
            api_token=user_settings.generation_api_token
        )

    return get_generation_service()


def get_embedding_service_for_user(db, user_id: int) -> LLMService:
    """
    Get an embedding LLM service for a specific user.
    Checks user settings for custom configuration.
    """
    from app.models.settings import Settings

    user_settings = db.query(Settings).filter(Settings.user_id == user_id).first()

    if user_settings:
        return get_embedding_service(
            url=user_settings.embedding_url,
            model=user_settings.embedding_model,
            api_token=user_settings.embedding_api_token
        )

    return get_embedding_service()


# Default service instances (using environment defaults)
default_generation_service = get_generation_service()
default_embedding_service = get_embedding_service()
