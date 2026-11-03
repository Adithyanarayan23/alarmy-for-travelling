import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.journey import JourneyStatus
from app.models.user import User
from app.schemas.eta import EtaResponse
from app.schemas.journey import JourneyCreate, JourneyOut, JourneyUpdate
from app.services.journey_service import journey_service

router = APIRouter(prefix="/journeys", tags=["Journeys"])


@router.post(
    "",
    response_model=JourneyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new journey and schedule travel alarm",
)
async def create_journey(
    payload: JourneyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JourneyOut:
    """Create a journey, calculate initial driving ETA via OSRM, and compute alarm time."""
    journey = await journey_service.create_journey(
        db=db, user_id=current_user.id, payload=payload
    )
    return JourneyOut.model_validate(journey)


@router.get(
    "",
    response_model=list[JourneyOut],
    status_code=status.HTTP_200_OK,
    summary="List current user's journeys",
)
async def list_journeys(
    status_filter: JourneyStatus | None = Query(
        default=None, alias="status", description="Optional filter by journey status"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JourneyOut]:
    """List all journeys belonging to the authenticated user."""
    journeys = await journey_service.list_user_journeys(
        db=db, user_id=current_user.id, status_filter=status_filter
    )
    return [JourneyOut.model_validate(j) for j in journeys]


@router.get(
    "/{journey_id}",
    response_model=JourneyOut,
    status_code=status.HTTP_200_OK,
    summary="Get journey details",
)
async def get_journey(
    journey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JourneyOut:
    """Retrieve a specific journey by ID."""
    journey = await journey_service.get_user_journey(
        db=db, journey_id=journey_id, user_id=current_user.id
    )
    return JourneyOut.model_validate(journey)


@router.get(
    "/{journey_id}/eta",
    response_model=EtaResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate fresh ETA and suggested alarm time for a journey",
)
async def get_journey_eta(
    journey_id: uuid.UUID,
    current_lat: float | None = Query(
        default=None, ge=-90.0, le=90.0, description="Optional live latitude"
    ),
    current_lon: float | None = Query(
        default=None, ge=-180.0, le=180.0, description="Optional live longitude"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EtaResponse:
    """Fetch a fresh ETA from OSRM and return updated ETA and alarm timestamp."""
    return await journey_service.get_fresh_eta(
        db=db,
        journey_id=journey_id,
        user_id=current_user.id,
        current_lat=current_lat,
        current_lon=current_lon,
    )


@router.patch(
    "/{journey_id}",
    response_model=JourneyOut,
    status_code=status.HTTP_200_OK,
    summary="Update journey status, buffer, or ETA",
)
async def update_journey(
    journey_id: uuid.UUID,
    payload: JourneyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JourneyOut:
    """Partially update a journey's status, alarm buffer, or ETA."""
    journey = await journey_service.update_journey(
        db=db,
        journey_id=journey_id,
        user_id=current_user.id,
        payload=payload,
    )
    return JourneyOut.model_validate(journey)


@router.delete(
    "/{journey_id}",
    response_model=JourneyOut,
    status_code=status.HTTP_200_OK,
    summary="Cancel an active journey",
)
async def cancel_journey(
    journey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JourneyOut:
    """Cancel a journey by setting its status to 'cancelled'."""
    journey = await journey_service.cancel_journey(
        db=db, journey_id=journey_id, user_id=current_user.id
    )
    return JourneyOut.model_validate(journey)
