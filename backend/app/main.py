from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager to initialize DB on startup and dispose engine on shutdown."""
    logger.info("Starting up %s v%s...", settings.PROJECT_NAME, settings.VERSION)
    try:
        await init_db()
    except Exception as exc:
        logger.warning(
            "Database initialization warning on startup (DB may still be starting): %s",
            exc,
        )
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Backend API for Alarmy for Travelling — a smart destination-based travel "
        "alarm application with dynamic ETA tracking, Nominatim geocoding, OSRM routing, "
        "and AI-assisted natural language trip parsing."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"], summary="Health check endpoint")
async def health_check() -> dict[str, str]:
    """Return service health status."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }
