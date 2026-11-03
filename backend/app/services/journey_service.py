import logging
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.destination import Destination
from app.models.eta_update import EtaUpdate
from app.models.journey import Journey, JourneyStatus
from app.schemas.eta import EtaResponse
from app.schemas.journey import JourneyCreate, JourneyUpdate
from app.services.destination_service import DestinationService, destination_service
from app.services.eta_service import ETAService, get_eta_service

logger = logging.getLogger(__name__)


class JourneyService:
    """Service encapsulating business logic for Journeys and Alarm scheduling."""

    def __init__(
        self,
        eta_srv: ETAService | None = None,
        dest_srv: DestinationService | None = None,
    ) -> None:
        self.eta_service = eta_srv or get_eta_service()
        self.dest_service = dest_srv or destination_service

    @staticmethod
    def calculate_alarm_time(eta: datetime, buffer_minutes: int) -> datetime:
        """Compute the scheduled alarm timestamp as `ETA - buffer_minutes`."""
        return eta - timedelta(minutes=buffer_minutes)

    async def create_journey(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        payload: JourneyCreate,
    ) -> Journey:
        """Create a new journey, compute initial ETA, and schedule the alarm."""
        destination: Destination
        if payload.destination_id is not None:
            destination = await self.dest_service.get_destination_by_id(
                db, payload.destination_id
            )
        elif payload.destination is not None:
            destination = await self.dest_service.create_destination(
                db, payload.destination
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Destination details or destination_id must be provided.",
            )

        eta_result = await self.eta_service.get_eta(
            origin_lat=payload.origin_latitude,
            origin_lon=payload.origin_longitude,
            dest_lat=destination.latitude,
            dest_lon=destination.longitude,
        )
        alarm_scheduled_at = self.calculate_alarm_time(
            eta_result.estimated_arrival, payload.alarm_buffer_minutes
        )

        journey = Journey(
            user_id=user_id,
            destination_id=destination.id,
            origin_latitude=payload.origin_latitude,
            origin_longitude=payload.origin_longitude,
            status=JourneyStatus.ACTIVE,
            alarm_buffer_minutes=payload.alarm_buffer_minutes,
            current_eta=eta_result.estimated_arrival,
            alarm_scheduled_at=alarm_scheduled_at,
        )
        db.add(journey)
        await db.flush()

        eta_update = EtaUpdate(
            journey_id=journey.id,
            previous_eta=None,
            new_eta=eta_result.estimated_arrival,
            source=eta_result.source,
        )
        db.add(eta_update)
        await db.commit()

        stmt = (
            select(Journey)
            .options(selectinload(Journey.destination))
            .where(Journey.id == journey.id)
        )
        created = (await db.execute(stmt)).scalar_one()
        logger.info(
            "Created journey %s for user %s (ETA=%s, alarm=%s)",
            created.id,
            user_id,
            created.current_eta,
            created.alarm_scheduled_at,
        )
        return created

    async def list_user_journeys(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        status_filter: JourneyStatus | None = None,
    ) -> list[Journey]:
        """List all journeys belonging to a user, newest first."""
        stmt = (
            select(Journey)
            .options(selectinload(Journey.destination))
            .where(Journey.user_id == user_id)
            .order_by(Journey.created_at.desc())
        )
        if status_filter is not None:
            stmt = stmt.where(Journey.status == status_filter)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_user_journey(
        self,
        db: AsyncSession,
        journey_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Journey:
        """Fetch a single journey by ID verifying ownership."""
        stmt = (
            select(Journey)
            .options(selectinload(Journey.destination))
            .where(Journey.id == journey_id, Journey.user_id == user_id)
        )
        journey = (await db.execute(stmt)).scalar_one_or_none()
        if journey is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Journey {journey_id} not found.",
            )
        return journey

    async def get_fresh_eta(
        self,
        db: AsyncSession,
        journey_id: uuid.UUID,
        user_id: uuid.UUID,
        current_lat: float | None = None,
        current_lon: float | None = None,
    ) -> EtaResponse:
        """Compute live ETA for a journey and update stored ETA if active."""
        journey = await self.get_user_journey(db, journey_id, user_id)

        origin_lat = (
            current_lat if current_lat is not None else journey.origin_latitude
        )
        origin_lon = (
            current_lon if current_lon is not None else journey.origin_longitude
        )

        eta_result = await self.eta_service.get_eta(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=journey.destination.latitude,
            dest_lon=journey.destination.longitude,
        )
        alarm_time = self.calculate_alarm_time(
            eta_result.estimated_arrival, journey.alarm_buffer_minutes
        )

        if journey.status == JourneyStatus.ACTIVE:
            previous_eta = journey.current_eta
            journey.current_eta = eta_result.estimated_arrival
            journey.alarm_scheduled_at = alarm_time
            if current_lat is not None and current_lon is not None:
                journey.origin_latitude = current_lat
                journey.origin_longitude = current_lon
            journey.updated_at = datetime.now(timezone.utc)

            eta_update = EtaUpdate(
                journey_id=journey.id,
                previous_eta=previous_eta,
                new_eta=eta_result.estimated_arrival,
                source=eta_result.source,
            )
            db.add(eta_update)
            await db.commit()

        return EtaResponse(
            eta=eta_result.estimated_arrival,
            duration_seconds=eta_result.duration_seconds,
            distance_meters=eta_result.distance_meters,
            alarm_time=alarm_time,
            source=eta_result.source,
        )

    async def update_journey(
        self,
        db: AsyncSession,
        journey_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: JourneyUpdate,
    ) -> Journey:
        """Update journey status, buffer, coordinates, or ETA fields."""
        journey = await self.get_user_journey(db, journey_id, user_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "current_eta" in update_data and update_data["current_eta"] is not None:
            previous_eta = journey.current_eta
            new_eta = update_data["current_eta"]
            if previous_eta != new_eta:
                db.add(
                    EtaUpdate(
                        journey_id=journey.id,
                        previous_eta=previous_eta,
                        new_eta=new_eta,
                        source="manual_patch",
                    )
                )

        for field, value in update_data.items():
            setattr(journey, field, value)

        # Recalculate alarm_scheduled_at if buffer or current_eta changed and alarm_scheduled_at wasn't explicitly set
        if (
            ("alarm_buffer_minutes" in update_data or "current_eta" in update_data)
            and "alarm_scheduled_at" not in update_data
            and journey.current_eta is not None
        ):
            journey.alarm_scheduled_at = self.calculate_alarm_time(
                journey.current_eta, journey.alarm_buffer_minutes
            )

        journey.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(journey)
        return journey

    async def cancel_journey(
        self,
        db: AsyncSession,
        journey_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Journey:
        """Mark a journey as cancelled."""
        journey = await self.get_user_journey(db, journey_id, user_id)
        journey.status = JourneyStatus.CANCELLED
        journey.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(journey)
        logger.info("Cancelled journey %s for user %s", journey.id, user_id)
        return journey


journey_service = JourneyService()
