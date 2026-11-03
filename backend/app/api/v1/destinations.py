import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.destination import DestinationCreate, DestinationOut
from app.services.destination_service import destination_service

router = APIRouter(prefix="/destinations", tags=["Destinations"])


@router.get(
    "/search",
    response_model=list[DestinationOut],
    status_code=status.HTTP_200_OK,
    summary="Search destinations using Nominatim geocoding",
)
async def search_destinations(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(10, ge=1, le=50, description="Max number of results"),
    current_user: User = Depends(get_current_user),
) -> list[DestinationOut]:
    """Geocode a query string via OpenStreetMap Nominatim and return matching destinations."""
    return await destination_service.search_nominatim(query=q, limit=limit)


@router.post(
    "",
    response_model=DestinationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a destination to the database",
)
async def create_destination(
    payload: DestinationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DestinationOut:
    """Persist a chosen destination in PostgreSQL."""
    destination = await destination_service.create_destination(db, payload)
    return DestinationOut.model_validate(destination)


@router.get(
    "/{destination_id}",
    response_model=DestinationOut,
    status_code=status.HTTP_200_OK,
    summary="Get a saved destination by ID",
)
async def get_destination(
    destination_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DestinationOut:
    """Fetch a saved destination by its UUID."""
    destination = await destination_service.get_destination_by_id(
        db, destination_id
    )
    return DestinationOut.model_validate(destination)
