import logging
import uuid
from fastapi import HTTPException, status
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.destination import Destination
from app.schemas.destination import DestinationCreate, DestinationOut

logger = logging.getLogger(__name__)


class DestinationService:
    """Service for geocoding via Nominatim and persisting destinations."""

    def __init__(self, base_url: str | None = None, timeout: float = 10.0) -> None:
        self.base_url = (base_url or settings.NOMINATIM_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.headers = {
            "User-Agent": settings.NOMINATIM_USER_AGENT,
            "Accept": "application/json",
        }

    async def search_nominatim(
        self, query: str, limit: int = 10
    ) -> list[DestinationOut]:
        """Search OpenStreetMap Nominatim API for matching locations."""
        url = f"{self.base_url}/search"
        params = {
            "q": query,
            "format": "json",
            "addressdetails": 1,
            "limit": limit,
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                items = response.json()
        except httpx.HTTPError as exc:
            logger.error("Nominatim geocoding request failed for query '%s': %s", query, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach geocoding provider. Please try again later.",
            ) from exc

        results: list[DestinationOut] = []
        for item in items:
            try:
                lat = float(item["lat"])
                lon = float(item["lon"])
            except (KeyError, ValueError, TypeError):
                continue

            display_name = item.get("display_name") or query
            name = (
                item.get("name")
                or display_name.split(",")[0].strip()
                or query
            )
            address = item.get("address") or {}
            country = address.get("country")

            results.append(
                DestinationOut(
                    id=None,
                    name=name[:255],
                    display_name=display_name,
                    latitude=lat,
                    longitude=lon,
                    country=country[:128] if country else None,
                    created_at=None,
                )
            )

        return results

    async def create_destination(
        self, db: AsyncSession, data: DestinationCreate
    ) -> Destination:
        """Persist a selected destination in the database (or return existing match)."""
        stmt = select(Destination).where(
            Destination.latitude == data.latitude,
            Destination.longitude == data.longitude,
            Destination.name == data.name,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            return existing

        destination = Destination(
            name=data.name,
            display_name=data.display_name,
            latitude=data.latitude,
            longitude=data.longitude,
            country=data.country,
        )
        db.add(destination)
        await db.commit()
        await db.refresh(destination)
        return destination

    async def get_destination_by_id(
        self, db: AsyncSession, destination_id: uuid.UUID
    ) -> Destination:
        """Retrieve a destination by its UUID or raise 404."""
        result = await db.execute(
            select(Destination).where(Destination.id == destination_id)
        )
        destination = result.scalar_one_or_none()
        if destination is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Destination {destination_id} not found.",
            )
        return destination


destination_service = DestinationService()
