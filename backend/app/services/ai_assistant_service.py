import json
import logging
import re
from typing import Any
from openai import AsyncOpenAI, OpenAIError

from app.core.config import settings
from app.schemas.ai_assistant import AiParseResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a travel assistant. Extract the destination and wake-up buffer "
    "(default 30 minutes) from the user's message. Return only valid JSON with "
    "keys: destination (string) and wake_buffer_minutes (integer)."
)


class AiAssistantService:
    """Service for parsing natural-language travel alarm prompts using OpenAI."""

    def __init__(self) -> None:
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL

    def _has_valid_api_key(self) -> bool:
        """Return True if a usable OpenAI API key is configured."""
        if not self.api_key:
            return False
        stripped = self.api_key.strip()
        if stripped in {"", "sk-...", "your-openai-api-key"}:
            return False
        return True

    @staticmethod
    def _fallback_parse(text: str, error_reason: str | None = None) -> AiParseResponse:
        """Heuristic regex parser used when OpenAI API key is missing or call fails."""
        wake_buffer = settings.ALARM_BUFFER_MINUTES

        # Look for buffer patterns such as "30 min", "45 minutes", "1 hour", "2 hrs"
        min_match = re.search(
            r"(\d+)\s*(?:min|mins|minute|minutes)\b", text, flags=re.IGNORECASE
        )
        hour_match = re.search(
            r"(\d+)\s*(?:hr|hrs|hour|hours)\b", text, flags=re.IGNORECASE
        )
        if min_match:
            wake_buffer = int(min_match.group(1))
        elif hour_match:
            wake_buffer = int(hour_match.group(1)) * 60

        wake_buffer = max(1, min(wake_buffer, 720))

        # Look for destination after keywords like "going to", "travelling to", "headed to", "to", "in", "at"
        dest_match = re.search(
            r"(?:going\s+to|travel(?:l)?ing\s+to|headed\s+to|heading\s+to|bound\s+for|train\s+to|bus\s+to|flight\s+to|to)\s+([A-Za-z][A-Za-z\s\.\-]{1,60}?)(?:\s+(?:tonight|today|tomorrow|this\s+\w+|at\b|and\b|wake\b|alarm\b|before\b|in\s+\d+)|[,.;!?]|$)",
            text,
            flags=re.IGNORECASE,
        )
        if dest_match:
            destination = dest_match.group(1).strip()
        else:
            # Fallback: strip common filler words or take capitalized words
            cap_words = re.findall(r"\b[A-Z][a-zA-Z]{2,}\b", text)
            ignored = {
                "Wake",
                "Alarm",
                "Going",
                "Travelling",
                "Traveling",
                "Please",
                "Set",
                "Before",
                "Minutes",
                "Tonight",
                "Tomorrow",
                "Today",
            }
            candidates = [w for w in cap_words if w not in ignored]
            destination = " ".join(candidates) if candidates else text.strip()[:60]

        raw: dict[str, Any] = {
            "provider": "heuristic_fallback",
            "extracted": {
                "destination": destination,
                "wake_buffer_minutes": wake_buffer,
            },
        }
        if error_reason:
            raw["fallback_reason"] = error_reason

        return AiParseResponse(
            destination=destination,
            wake_buffer_minutes=wake_buffer,
            raw_response=raw,
        )

    async def parse_journey_prompt(self, text: str) -> AiParseResponse:
        """Extract destination and wake-up buffer from natural language text."""
        if not self._has_valid_api_key():
            logger.info("OpenAI API key not configured; using heuristic fallback parser.")
            return self._fallback_parse(
                text, error_reason="OPENAI_API_KEY not configured"
            )

        try:
            client = AsyncOpenAI(api_key=self.api_key)
            completion = await client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0.1,
            )

            content = completion.choices[0].message.content or "{}"
            parsed: dict[str, Any] = json.loads(content)

            destination = str(parsed.get("destination") or "").strip()
            if not destination:
                return self._fallback_parse(
                    text, error_reason="Empty destination in LLM response"
                )

            raw_buffer = parsed.get(
                "wake_buffer_minutes", settings.ALARM_BUFFER_MINUTES
            )
            try:
                wake_buffer_minutes = int(raw_buffer)
            except (ValueError, TypeError):
                wake_buffer_minutes = settings.ALARM_BUFFER_MINUTES

            wake_buffer_minutes = max(1, min(wake_buffer_minutes, 720))

            return AiParseResponse(
                destination=destination,
                wake_buffer_minutes=wake_buffer_minutes,
                raw_response=completion.model_dump(),
            )
        except (OpenAIError, json.JSONDecodeError, Exception) as exc:
            logger.warning("OpenAI parse failed (%s); falling back to heuristic.", exc)
            return self._fallback_parse(text, error_reason=str(exc))


ai_assistant_service = AiAssistantService()
