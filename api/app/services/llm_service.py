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
import hashlib
import httpx
import json
import re
import logging
from typing import List, Dict, Optional, Any, AsyncGenerator

from app.core.config import settings as app_settings


class LLMProviderError(Exception):
    """Raised when the upstream LLM provider returns a non-2xx response.

    Attributes allow callers to distinguish 401/404/429/5xx and route them
    to appropriate user-facing messages.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        provider_url: str,
        body_snippet: str = "",
    ):
        super().__init__(message)
        self.status_code = status_code
        self.provider_url = provider_url
        self.body_snippet = body_snippet


class LLMStreamError(Exception):
    """Raised when a streaming completion is interrupted by a transport error.

    Wraps the underlying httpx exception so the caller can surface a
    generic error to the client without leaking provider internals.
    """

    def __init__(self, message: str, *, provider_url: str):
        super().__init__(message)
        self.provider_url = provider_url


class LLMService:
    """
    Service for interacting with OpenAI-compatible LLM APIs.

    Supports optional Bearer token authentication for cloud providers.
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

    def _raise_for_provider_status(self, response: httpx.Response, endpoint: str) -> None:
        """Inspect the response; on non-2xx, log the body snippet and raise LLMProviderError."""
        if response.status_code < 400:
            return

        try:
            body = response.text
        except Exception:
            body = ""
        body_snippet = body[:500] if body else ""

        self._logger.warning(
            "LLM provider error",
            extra={
                "provider_url": endpoint,
                "model": self.model,
                "status_code": response.status_code,
                "body_snippet": body_snippet,
            },
        )
        raise LLMProviderError(
            f"LLM provider returned {response.status_code}",
            status_code=response.status_code,
            provider_url=endpoint,
            body_snippet=body_snippet,
        )

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

    async def get_embedding(self, text: str) -> List[float]:
        """
        Get embedding vector using OpenAI-compatible embeddings endpoint.

        Uses POST /v1/embeddings with {"model": "...", "input": "..."}
        """
        endpoint = f"{self.base_url}/v1/embeddings"
        async with self._create_client() as client:
            response = await client.post(
                endpoint,
                json={"model": self.model, "input": text},
                timeout=30.0
            )
            self._raise_for_provider_status(response, endpoint)
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

        endpoint = f"{self.base_url}/v1/chat/completions"
        async with self._create_client() as client:
            response = await client.post(
                endpoint,
                json=payload,
                timeout=120.0
            )
            self._raise_for_provider_status(response, endpoint)
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

        endpoint = f"{self.base_url}/v1/chat/completions"
        async with self._create_client() as client:
            async with client.stream(
                "POST",
                endpoint,
                json=payload,
                timeout=120.0
            ) as response:
                if response.status_code >= 400:
                    try:
                        body_bytes = await response.aread()
                        body = body_bytes.decode("utf-8", errors="replace")
                    except Exception:
                        body = ""
                    body_snippet = body[:500] if body else ""
                    self._logger.warning(
                        "LLM provider error",
                        extra={
                            "provider_url": endpoint,
                            "model": self.model,
                            "status_code": response.status_code,
                            "body_snippet": body_snippet,
                        },
                    )
                    raise LLMProviderError(
                        f"LLM provider returned {response.status_code}",
                        status_code=response.status_code,
                        provider_url=endpoint,
                        body_snippet=body_snippet,
                    )

                try:
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
                                self._logger.debug(
                                    "Dropping malformed SSE frame",
                                    extra={"line": line[:200]},
                                )
                                continue
                except (
                    httpx.ReadError,
                    httpx.RemoteProtocolError,
                    httpx.TimeoutException,
                ) as e:
                    raise LLMStreamError(
                        "Upstream stream interrupted",
                        provider_url=endpoint,
                    ) from e

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
            response_hash = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:8]
            self._logger.debug(
                "Low confidence mood inference",
                extra={
                    "response_length": len(response_text),
                    "response_hash": response_hash,
                },
            )

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
        except (json.JSONDecodeError, ValueError, AttributeError):
            response_hash = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:8]
            self._logger.debug(
                "Failed to parse insights JSON",
                extra={
                    "response_length": len(response_text),
                    "response_hash": response_hash,
                },
                exc_info=True,
            )

        # Strategy 2: Use raw response as summary if JSON parsing fails
        if response_text.strip():
            return {
                "summary": response_text.strip(),
                "themes": [],
                "actions": []
            }

        return default_result

    async def generate_echo_framing(
        self,
        current_entry: str,
        current_entry_date: str,
        echoes: List[Dict[str, str]],
    ) -> str:
        """Generate a 2-3 sentence observation describing what connects the
        current entry to other semantically resonant entries from the user's
        journal. Echoes may be recent or years old; the framing should read
        naturally either way.

        `echoes` is a list of dicts with keys: 'date', 'content'.
        """
        echoes_text = "\n\n".join(
            f"[{e['date']}]\n{e['content'][:400]}" for e in echoes
        )

        system_prompt = (
            "You are a thoughtful journaling companion. The user is reading one of their "
            "journal entries. You are given that entry plus a few other entries of theirs "
            "that semantically resonate with it — some may be recent, some older.\n\n"
            "Write 2-3 sentences that gently observe the thread connecting them. "
            "Be warm, specific, and non-judgmental. Do NOT list the entries. Do NOT ask "
            "questions. Do NOT give advice. Just notice the thread out loud, like a close "
            "friend who remembers.\n\n"
            "RULES:\n"
            "- Under 400 characters total.\n"
            "- No bullet points, no headings, no emojis.\n"
            "- Reference dates naturally only when it adds clarity (e.g. 'last spring', "
            "  'a few days ago'); skip them for very recent matches.\n"
            "- Output only the observation itself, no preamble."
        )
        user_prompt = (
            f"Today's entry [{current_entry_date}]:\n{current_entry[:1200]}\n\n"
            f"Echoes from the past:\n{echoes_text}\n\n"
            "Write the observation:"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = await self.chat_completion(messages, temperature=0.7)
        return response.strip().strip('"').strip()

    async def generate_reverse_prompt(self, entries_text: str) -> Dict[str, str]:
        """Mine the user's recent corpus for something REFERENCED but NOT EXPLORED
        and return a gentle prompt inviting them to write about it.

        Returns dict with keys: gap_subject, rationale, prompt_text.
        """
        system_prompt = (
            "You analyze journal entries to find gaps — topics, people, events, or "
            "emotions the user has REFERENCED but never EXPLORED in depth. Find exactly "
            "one such gap and craft a gentle prompt inviting reflection on it.\n\n"
            "OUTPUT FORMAT (JSON only):\n"
            "{\n"
            '  "gap_subject": "2-4 words naming the gap (e.g., \'your mother\', \'the new job\', \'that recurring dream\')",\n'
            '  "rationale": "One sentence describing what you noticed (e.g., \'mentioned often but rarely described in depth\')",\n'
            '  "prompt_text": "A writing prompt under 20 words that invites exploring this gap"\n'
            "}\n\n"
            "RULES:\n"
            "- The gap must be REFERENCED in the entries but NOT explored. Not something never mentioned.\n"
            "- Be specific: 'your brother Mark' beats 'family'.\n"
            "- The prompt should feel inviting, not accusatory — no 'why haven't you' phrasing.\n"
            "- Output ONLY valid JSON, no explanations."
        )
        user_prompt = f"Recent journal entries:\n\n{entries_text}\n\nFind the gap (JSON only):"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = await self.chat_completion(messages, temperature=0.7)
        return self._parse_reverse_prompt_response(response)

    def _parse_reverse_prompt_response(self, response_text: str) -> Dict[str, str]:
        """Parse the gap-mining JSON response with defensive fallbacks."""
        try:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                parsed = json.loads(json_match.group())
                return {
                    "gap_subject": str(parsed.get("gap_subject", "something on your mind")).strip(),
                    "rationale": str(parsed.get("rationale", "")).strip(),
                    "prompt_text": str(parsed.get("prompt_text", "")).strip(),
                }
        except (json.JSONDecodeError, ValueError, AttributeError):
            self._logger.debug("Failed to parse reverse prompt JSON", exc_info=True)
        raise ValueError("Could not parse reverse prompt JSON")

    async def generate_welcome_back(self, entries_text: str) -> str:
        """Generate a short (1-2 sentence) personalized greeting based on the user's
        past week of entries. Returned as a plain string, no quotes."""
        system_prompt = (
            "You are a warm, thoughtful companion welcoming the user back to their "
            "journal. Based on what they wrote in the past week, craft a short "
            "(1-2 sentence) greeting that acknowledges where they've been without "
            "summarizing or quoting. Be specific but not intrusive.\n\n"
            "RULES:\n"
            "- Under 180 characters.\n"
            "- No questions. No lists. No emojis.\n"
            "- No cliches ('How are you?', 'Welcome back to your journey').\n"
            "- Feel like a friend noticing you, not a chatbot.\n"
            "- Output ONLY the message itself, no quotes, no preamble."
        )
        user_prompt = f"Past week's entries:\n\n{entries_text}\n\nGreeting:"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = await self.chat_completion(messages, temperature=0.8)
        # Defensive cleanup: LLMs sometimes wrap in quotes or add leading "Greeting:"
        cleaned = response.strip().strip('"').strip("'").strip()
        if cleaned.lower().startswith("greeting:"):
            cleaned = cleaned[len("greeting:"):].strip()
        return cleaned[:400]  # Hard cap so broken models can't blow up the toast

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


def get_generation_service(
    url: Optional[str] = None,
    model: Optional[str] = None,
    api_token: Optional[str] = None
) -> LLMService:
    """Get a generation LLM service instance."""
    return LLMService(
        base_url=url or app_settings.default_generation_url,
        model=model or app_settings.default_generation_model,
        api_token=api_token,
        service_type="generation"
    )


def get_embedding_service(
    url: Optional[str] = None,
    model: Optional[str] = None,
    api_token: Optional[str] = None
) -> LLMService:
    """Get an embedding LLM service instance."""
    return LLMService(
        base_url=url or app_settings.default_embedding_url,
        model=model or app_settings.default_embedding_model,
        api_token=api_token,
        service_type="embedding"
    )


def get_generation_service_for_user(db, user_id: int) -> LLMService:
    """Get a generation LLM service for a specific user."""
    from app.core.encryption import decrypt_token
    from app.models.settings import Settings

    user_settings = db.query(Settings).filter(Settings.user_id == user_id).first()

    if user_settings:
        raw_token = user_settings.generation_api_token
        return LLMService(
            base_url=user_settings.generation_url or app_settings.default_generation_url,
            model=user_settings.generation_model or app_settings.default_generation_model,
            api_token=decrypt_token(raw_token) if raw_token else None,
            service_type="generation",
        )

    return get_generation_service()


def get_embedding_service_for_user(db, user_id: int) -> LLMService:
    """Get an embedding LLM service for a specific user."""
    from app.core.encryption import decrypt_token
    from app.models.settings import Settings

    user_settings = db.query(Settings).filter(Settings.user_id == user_id).first()

    if user_settings:
        raw_token = user_settings.embedding_api_token
        return LLMService(
            base_url=user_settings.embedding_url or app_settings.default_embedding_url,
            model=user_settings.embedding_model or app_settings.default_embedding_model,
            api_token=decrypt_token(raw_token) if raw_token else None,
            service_type="embedding",
        )

    return get_embedding_service()
