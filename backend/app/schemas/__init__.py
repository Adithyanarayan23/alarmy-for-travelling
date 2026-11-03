"""Pydantic v2 request and response schemas."""
from app.schemas.ai_assistant import AiParseRequest, AiParseResponse
from app.schemas.destination import (
    DestinationCreate,
    DestinationOut,
    DestinationSearch,
)
from app.schemas.eta import EtaResponse, EtaUpdateOut
from app.schemas.journey import JourneyCreate, JourneyOut, JourneyUpdate
from app.schemas.user import Token, UserCreate, UserLogin, UserOut

__all__ = [
    "UserCreate",
    "UserLogin",
    "UserOut",
    "Token",
    "DestinationCreate",
    "DestinationOut",
    "DestinationSearch",
    "JourneyCreate",
    "JourneyOut",
    "JourneyUpdate",
    "EtaResponse",
    "EtaUpdateOut",
    "AiParseRequest",
    "AiParseResponse",
]
