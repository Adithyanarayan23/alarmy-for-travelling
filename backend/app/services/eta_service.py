import logging
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ETAResult:
    """Result returned by an ETA provider."""

    estimated_arrival: datetime
    duration_seconds: int
    distance_meters: int
    source: str


def _haversine_distance_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> int:
    """Calculate the great-circle distance in meters between two coordinates."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return int(round(r * c))


class ETAProvider(ABC):
    """Abstract interface for travel time and ETA providers."""

    @abstractmethod
    async def get_eta(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> ETAResult:
        """Compute ETA between origin and destination coordinates."""
        raise NotImplementedError


class OsrmETAProvider(ETAProvider):
    """ETA provider powered by the Open Source Routing Machine (OSRM) HTTP API."""

    def __init__(self, base_url: str | None = None, timeout: float = 10.0) -> None:
        self.base_url = (base_url or settings.OSRM_BASE_URL).rstrip("/")
        self.timeout = timeout

    async def get_eta(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> ETAResult:
        """Fetch driving route duration and distance from OSRM.

        Endpoint: {base_url}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false
        Falls back to a Haversine estimate (assuming 60 km/h average speed) if
        the external OSRM service is unreachable.
        """
        coords = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        url = f"{self.base_url}/route/v1/driving/{coords}"
        params = {"overview": "false"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            routes = data.get("routes")
            if not routes:
                raise ValueError(f"No routes returned by OSRM: {data}")

            route = routes[0]
            duration_seconds = int(round(float(route.get("duration", 0))))
            distance_meters = int(round(float(route.get("distance", 0))))
            now = datetime.now(timezone.utc)
            estimated_arrival = now + timedelta(seconds=duration_seconds)

            return ETAResult(
                estimated_arrival=estimated_arrival,
                duration_seconds=duration_seconds,
                distance_meters=distance_meters,
                source="osrm",
            )
        except Exception as exc:
            logger.warning(
                "OSRM request failed (%s). Falling back to Haversine estimation.",
                exc,
            )
            straight_distance = _haversine_distance_meters(
                origin_lat, origin_lon, dest_lat, dest_lon
            )
            road_distance = int(round(straight_distance * 1.25))
            avg_speed_mps = 16.67  # ~60 km/h
            duration_seconds = max(60, int(round(road_distance / avg_speed_mps)))
            now = datetime.now(timezone.utc)
            return ETAResult(
                estimated_arrival=now + timedelta(seconds=duration_seconds),
                duration_seconds=duration_seconds,
                distance_meters=road_distance,
                source="haversine_fallback",
            )


class ETAService:
    """High-level service for calculating ETAs using a configured ETAProvider."""

    def __init__(self, provider: ETAProvider | None = None) -> None:
        self.provider = provider or OsrmETAProvider()

    async def get_eta(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> ETAResult:
        return await self.provider.get_eta(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
        )


def get_eta_service() -> ETAService:
    """Factory function for ETAService."""
    return ETAService(provider=OsrmETAProvider())
