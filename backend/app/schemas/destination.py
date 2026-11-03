import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DestinationBase(BaseModel):
    """Base schema for Destination."""

    name: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    country: str | None = Field(default=None, max_length=128)


class DestinationCreate(DestinationBase):
    """Schema for creating/saving a destination to the database."""

    pass


class DestinationSearch(BaseModel):
    """Schema for destination search query parameters and geocoded result item."""

    q: str = Field(..., min_length=1, description="Search query string")
    limit: int = Field(default=10, ge=1, le=50)


class DestinationOut(DestinationBase):
    """Schema for returning a destination."""

    id: uuid.UUID | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
