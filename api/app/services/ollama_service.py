import httpx
import json
import re
import logging
import os
from typing import List, Optional, Dict
from app.core.config import settings


class OllamaService:
    """
    Service for interacting with Ollama API.
    Uses a shared httpx.AsyncClient for connection pooling and better performance.
    Caches prompt templates loaded from disk at initialization.
    """

    def __init__(self):
        self.base_url = settings.ollama_url
        self.embed_model = settings.embed_model
        self.reflection_model = settings.reflection_model
        self._client: Optional[httpx.AsyncClient] = None
        self._logger = logging.getLogger(__name__)

        # Cache prompt templates at initialization
        self._prompts: Dict[str, str] = self._load_prompts()

    def _load_prompts(self) -> Dict[str, str]:
        """
        Load all prompt templates from disk once at initialization.
        Returns a dictionary mapping prompt names to their content.
        """
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
        """
        Get or create the shared httpx.AsyncClient.
        This handles both FastAPI lifespan context and Celery task context.
        """
        if self._client is None or self._client.is_closed:
            # Create a new client with sensible defaults
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
            self._logger.debug("Created new httpx.AsyncClient")
        return self._client

    async def close(self):
        """Close the shared httpx client. Called during app shutdown."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._logger.debug("Closed httpx.AsyncClient")

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding vector from Ollama"""
        client = self._get_client()
        response = await client.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.embed_model, "prompt": text},
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
        return data["embedding"]

    async def generate_reflection(self, entries_text: str) -> str:
        """Generate reflection from entries using Ollama"""
        prompt = self._prompts["reflection"].format(entries=entries_text)

        client = self._get_client()
        response = await client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.reflection_model,
                "prompt": prompt,
                "stream": False
            },
            timeout=120.0
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")

    async def infer_mood(self, entry_content: str) -> int:
        """Infer mood (1-5) from entry content"""
        prompt = self._prompts["mood_infer"].format(content=entry_content)

        client = self._get_client()
        response = await client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.reflection_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3
                }
            },
            timeout=300.0
        )
        response.raise_for_status()
        data = response.json()
        response_text = data.get("response", "").strip()

        # Parse mood with multiple strategies
        mood = None
        confidence = "low"

        # Strategy 1: Try JSON parsing (primary method)
        try:
            # Extract JSON object from response (handles extra text)
            json_match = re.search(r'\{[^}]+\}', response_text)
            if json_match:
                parsed = json.loads(json_match.group())
                mood = int(parsed.get("mood", 3))
                confidence = parsed.get("confidence", "low")
        except (json.JSONDecodeError, ValueError, AttributeError):
            pass

        # Strategy 2: Try extracting first integer in range 1-5 (fallback)
        if mood is None:
            try:
                numbers = re.findall(r'\b([1-5])\b', response_text)
                if numbers:
                    mood = int(numbers[0])
                    confidence = "low"
            except (ValueError, IndexError):
                pass

        # Strategy 3: Try word-to-number mapping (handles "three", etc.)
        if mood is None:
            word_map = {
                "one": 1, "two": 2, "three": 3, "four": 4, "five": 5
            }
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

        # Log low-confidence inferences for monitoring
        if confidence == "low":
            logging.warning(f"Low confidence mood inference. Raw response: {response_text[:100]}")

        return mood

    async def generate_insights(self, entries_summary: str) -> dict:
        """Generate insights (summary, themes, actions) from entries"""
        prompt = self._prompts["reflection"].format(entries=entries_summary)

        client = self._get_client()
        response = await client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.reflection_model,
                "prompt": prompt,
                "stream": False
            },
            timeout=120.0
        )
        response.raise_for_status()
        data = response.json()
        reflection = data.get("response", "")

        # Parse reflection into structured format
        # This is a simplified parser - in production, use structured output
        return {
            "summary": reflection[:500],  # First 500 chars as summary
            "themes": [],  # Would parse from reflection
            "actions": []  # Would parse from reflection
        }


ollama_service = OllamaService()

