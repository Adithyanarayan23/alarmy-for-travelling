import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.journey import JourneyStatus
from app.schemas.destination import DestinationCreate, DestinationOut


class JourneyCreate(BaseModel):
    """Schema for creating a new journey.

    Supports either referencing an existing `destination_id` or passing
    `destination` details inline (or top-level destination_* fields).
    """

    destination_id: uuid.UUID | None = None
    destination: DestinationCreate | None = None
    destination_name: str | None = None
    destination_display_name: str | None = None
    destination_latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    destination_longitude: float | None = Field(default=None, ge=-180.0, le=180.0)
    destination_country: str | None = None

    origin_latitude: float = Field(..., ge=-90.0, le=90.0)
    origin_longitude: float = Field(..., ge=-180.0, le=180.0)
    alarm_buffer_minutes: int = Field(default=30, ge=1, le=720)

    @model_validator(mode="after")
    def validate_destination_source(self) -> "JourneyCreate":
        if self.destination_id is not None or self.destination is not None:
            return self
        if (
            self.destination_name
            and self.destination_latitude is not None
            and self.destination_longitude is not None
        ):
            self.destination = DestinationCreate(
                name=self.destination_name,
                display_name=self.destination_display_name or self.destination_name,
                latitude=self.destination_latitude,
                longitude=self.destination_longitude,
                country=self.destination_country,
            )
            return self
        raise ValueError(
            "Must provide either 'destination_id', 'destination' object, or "
            "inline 'destination_name', 'destination_latitude', and 'destination_longitude'."
        )


class JourneyUpdate(BaseModel):
    """Schema for updating an existing journey."""

    status: JourneyStatus | None = None
    alarm_buffer_minutes: int | None = Field(default=None, ge=1, le=720)
    current_eta: datetime | None = None
    alarm_scheduled_at: datetime | None = None
    origin_latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    origin_longitude: float | None = Field(default=None, ge=-180.0, le=180.0)


class JourneyOut(BaseModel):
    """Schema for journey output response."""

    id: uuid.UUID
    user_id: uuid.UUID
    destination_id: uuid.UUID
    destination: DestinationOut | None = None
    origin_latitude: float
    origin_longitude: float
    status: JourneyStatus
    alarm_buffer_minutes: int
    current_eta: datetime | None = None
    alarm_scheduled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
