from fastapi import APIRouter

from app.api.v1 import ai_assistant, auth, destinations, journeys

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(journeys.router)
api_router.include_router(destinations.router)
api_router.include_router(ai_assistant.router)
