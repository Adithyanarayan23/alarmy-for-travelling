import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.eta_update import EtaUpdate
from app.models.journey import Journey, JourneyStatus
from app.services.eta_service import get_eta_service
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _refresh_active_journeys_async() -> dict[str, Any]:
    """Query all active journeys, refresh ETAs via OSRM, and record changes exceeding threshold."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    eta_service = get_eta_service()

    checked_count = 0
    updated_count = 0
    errors_count = 0

    try:
        async with session_factory() as session:
            stmt = (
                select(Journey)
                .options(selectinload(Journey.destination))
                .where(Journey.status == JourneyStatus.ACTIVE)
            )
            result = await session.execute(stmt)
            active_journeys = list(result.scalars().all())

            logger.info(
                "Polling ETAs for %d active journeys.", len(active_journeys)
            )

            for journey in active_journeys:
                checked_count += 1
                try:
                    eta_result = await eta_service.get_eta(
                        origin_lat=journey.origin_latitude,
                        origin_lon=journey.origin_longitude,
                        dest_lat=journey.destination.latitude,
                        dest_lon=journey.destination.longitude,
                    )
                    new_eta = eta_result.estimated_arrival
                    current_eta = journey.current_eta

                    should_update = False
                    if current_eta is None:
                        should_update = True
                    else:
                        if current_eta.tzinfo is None:
                            current_eta = current_eta.replace(tzinfo=timezone.utc)
                        delta_seconds = abs(
                            (new_eta - current_eta).total_seconds()
                        )
                        if delta_seconds > settings.ETA_CHANGE_THRESHOLD_SECONDS:
                            should_update = True

                    if should_update:
                        eta_update = EtaUpdate(
                            journey_id=journey.id,
                            previous_eta=current_eta,
                            new_eta=new_eta,
                            source="celery_poll",
                        )
                        session.add(eta_update)

                        journey.current_eta = new_eta
                        journey.alarm_scheduled_at = new_eta - timedelta(
                            minutes=journey.alarm_buffer_minutes
                        )
                        journey.updated_at = datetime.now(timezone.utc)
                        updated_count += 1
                        logger.info(
                            "Updated journey %s ETA: %s -> %s (new alarm: %s)",
                            journey.id,
                            current_eta,
                            new_eta,
                            journey.alarm_scheduled_at,
                        )
                except Exception as exc:
                    errors_count += 1
                    logger.error(
                        "Failed to refresh ETA for journey %s: %s",
                        journey.id,
                        exc,
                    )

            if updated_count > 0:
                await session.commit()
    finally:
        await engine.dispose()

    return {
        "checked": checked_count,
        "updated": updated_count,
        "errors": errors_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="app.workers.tasks.refresh_eta_for_active_journeys")
def refresh_eta_for_active_journeys() -> dict[str, Any]:
    """Periodic Celery task that refreshes ETAs for all active journeys."""
    logger.info("Starting periodic ETA refresh task...")
    summary = asyncio.run(_refresh_active_journeys_async())
    logger.info("Completed periodic ETA refresh task: %s", summary)
    return summary
