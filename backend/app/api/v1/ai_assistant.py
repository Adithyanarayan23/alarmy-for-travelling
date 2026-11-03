from fastapi import APIRouter, Depends, status

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ai_assistant import AiParseRequest, AiParseResponse
from app.services.ai_assistant_service import ai_assistant_service

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post(
    "/parse-journey",
    response_model=AiParseResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract destination and wake buffer from natural language text",
)
async def parse_journey(
    payload: AiParseRequest,
    current_user: User = Depends(get_current_user),
) -> AiParseResponse:
    """Parse user message (e.g. 'I'm going to Bangalore tonight, wake me 30 min before')."""
    return await ai_assistant_service.parse_journey_prompt(payload.text)
