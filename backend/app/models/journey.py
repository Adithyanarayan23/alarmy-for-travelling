import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.database import Base


class JourneyStatus(str, enum.Enum):
    """Enumeration of possible journey states."""

    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Journey(Base):
    """Journey database model representing an active or past travel alarm session."""

    __tablename__ = "journeys"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    destination_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("destinations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    origin_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    origin_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[JourneyStatus] = mapped_column(
        Enum(
            JourneyStatus,
            name="journey_status_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=JourneyStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    alarm_buffer_minutes: Mapped[int] = mapped_column(
        Integer, default=settings.ALARM_BUFFER_MINUTES, nullable=False
    )
    current_eta: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    alarm_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="journeys")
    destination = relationship(
        "Destination", back_populates="journeys", lazy="selectin"
    )
    eta_updates = relationship(
        "EtaUpdate",
        back_populates="journey",
        cascade="all, delete-orphan",
        order_by="EtaUpdate.created_at.desc()",
    )
