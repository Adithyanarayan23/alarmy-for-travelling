import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EtaResponse(BaseModel):
    """Schema for real-time ETA calculation response."""

    eta: datetime
    duration_seconds: int
    distance_meters: int
    alarm_time: datetime
    source: str = "osrm"


class EtaUpdateOut(BaseModel):
    """Schema for ETA update audit log record."""

    id: uuid.UUID
    journey_id: uuid.UUID
    previous_eta: datetime | None = None
    new_eta: datetime
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
