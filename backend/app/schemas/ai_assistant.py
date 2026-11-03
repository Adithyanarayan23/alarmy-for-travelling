from typing import Any
from pydantic import BaseModel, Field


class AiParseRequest(BaseModel):
    """Request schema for natural language journey parsing."""

    text: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        examples=["I'm going to Bangalore tonight, wake me 30 min before"],
    )


class AiParseResponse(BaseModel):
    """Response schema for extracted destination and wake buffer."""

    destination: str
    wake_buffer_minutes: int = Field(default=30, ge=1, le=720)
    raw_response: dict[str, Any]
