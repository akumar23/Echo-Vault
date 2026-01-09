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
from typing import List, Optional, Dict, Any, AsyncGenerator

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

    def _create_client(self) -> httpx.AsyncClient:
        """
        Create a new httpx.AsyncClient.

        Note: We intentionally create a fresh client for each request to avoid
        'Event loop is closed' errors when used with asyncio.run() in Celery workers.
        The client creation overhead (~1ms) is negligible compared to LLM inference
        time (~5-30s).
        """
        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        return httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            headers=headers
        )

    async def close(self):
        """Close the shared httpx client (no-op, clients are now per-request)."""
        pass

    async def get_embedding(self, text: str) -> List[float]:
        """
        Get embedding vector using OpenAI-compatible embeddings endpoint.

        Uses POST /v1/embeddings with {"model": "...", "input": "..."}
        """
        async with self._create_client() as client:
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
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": False
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with self._create_client() as client:
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

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generate text using OpenAI-compatible chat completions endpoint with streaming.
        Yields tokens as they are generated.

        Uses POST /v1/chat/completions with {"model": "...", "messages": [...], "stream": true}
        """
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with self._create_client() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                timeout=120.0
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    # SSE format: "data: {...}" or "data: [DONE]"
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

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
            "Analyze journal entries. Output observations and actionable advice.\n\n"
            "Respond in valid JSON:\n"
            "{\n"
            '  "summary": "Brief factual summary. State observed patterns and behaviors. No emotional language.",\n'
            '  "themes": ["theme1", "theme2", "theme3"],\n'
            '  "actions": [\n'
            '    "Concrete action with specific parameters (time, frequency, duration)",\n'
            '    "Another specific action",\n'
            '    "Another specific action"\n'
            "  ]\n"
            "}\n\n"
            "RULES:\n"
            "- Summary: State what was observed. No commentary or encouragement.\n"
            "- Themes: Single words or short phrases only.\n"
            "- Actions: Specific and measurable (e.g., '10-min walk before 9am' not 'exercise more').\n"
            "- No filler phrases, no emotional validation, no rhetorical questions.\n"
            "- Be direct and clinical.\n\n"
            "Output ONLY valid JSON."
        )
        user_prompt = f"Journal Entries:\n{entries_summary}\n\nAnalyze (JSON only):"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response_text = await self.chat_completion(messages, temperature=0.7)
        return self._parse_insights_response(response_text)

    def _parse_insights_response(self, response_text: str) -> dict:
        """Parse insights from LLM response with fallback strategies."""
        default_result = {
            "summary": "",
            "themes": [],
            "actions": []
        }

        # Strategy 1: Try JSON parsing
        try:
            # Find JSON object in response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                parsed = json.loads(json_match.group())
                return {
                    "summary": parsed.get("summary", ""),
                    "themes": parsed.get("themes", [])[:5],  # Limit to 5 themes
                    "actions": parsed.get("actions", [])[:5]  # Limit to 5 actions
                }
        except (json.JSONDecodeError, ValueError, AttributeError) as e:
            self._logger.warning(f"Failed to parse insights JSON: {e}")

        # Strategy 2: Use raw response as summary if JSON parsing fails
        if response_text.strip():
            return {
                "summary": response_text.strip(),
                "themes": [],
                "actions": []
            }

        return default_result

    async def extract_common_theme(self, entry_texts: List[str]) -> str:
        """
        Identify the common theme across multiple journal entries.

        Returns a short phrase (2-4 words) describing the shared topic,
        e.g., "nature walks", "work stress", "creative projects".
        """
        # Truncate entries to avoid token limits
        truncated_entries = []
        for text in entry_texts[:10]:  # Max 10 entries
            truncated = text[:500] if len(text) > 500 else text
            truncated_entries.append(truncated)

        entries_text = "\n\n---\n\n".join(truncated_entries)

        system_prompt = (
            "You are a theme extraction assistant. Analyze journal entries and identify the common theme.\n\n"
            "INSTRUCTIONS:\n"
            "- Return ONLY a short phrase (2-4 words) describing the shared topic\n"
            "- Be specific: 'outdoor hiking' not just 'nature'\n"
            "- Examples: 'creative writing', 'work deadlines', 'family gatherings', 'fitness goals'\n"
            "- No explanations, no punctuation, just the theme phrase"
        )
        user_prompt = f"Identify the common theme in these entries:\n\n{entries_text}\n\nCommon theme:"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = await self.chat_completion(messages, temperature=0.3)
        # Clean up response - remove quotes, extra whitespace, periods
        theme = response.strip().strip('"\'').strip('.').lower()
        # Limit to reasonable length
        if len(theme) > 50:
            theme = theme[:50].rsplit(' ', 1)[0]
        return theme


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
