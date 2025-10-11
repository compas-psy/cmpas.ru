"""User consent management endpoints."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.consent import ConsentType
from app.schemas.consent import ConsentStatus, ConsentLogEntry, ConsentActionRequest
from app.services.consent_service import (
    list_user_consents,
    list_user_consent_logs,
    accept_consent,
    withdraw_consent,
)
from app.utils.request_meta import get_request_meta

router = APIRouter(prefix="/consents", tags=["consents"])


@router.get("/", response_model=list[ConsentStatus], status_code=status.HTTP_200_OK)
async def get_consents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConsentStatus]:
    consents = await list_user_consents(db=db, user_id=current_user.id)
    return [ConsentStatus.model_validate(item) for item in consents]


@router.get(
    "/{consent_type}/logs",
    response_model=list[ConsentLogEntry],
    status_code=status.HTTP_200_OK,
)
async def get_consent_logs(
    consent_type: ConsentType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConsentLogEntry]:
    logs = await list_user_consent_logs(
        db=db,
        user_id=current_user.id,
        consent_type=consent_type,
    )
    return [ConsentLogEntry.model_validate(item) for item in logs]


@router.post(
    "/{consent_type}/accept",
    response_model=ConsentStatus,
    status_code=status.HTTP_200_OK,
)
async def accept_user_consent(
    request: Request,
    consent_type: ConsentType,
    payload: ConsentActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentStatus:
    status_dict = await accept_consent(
        db=db,
        user_id=current_user.id,
        consent_type=consent_type,
        document_id=payload.document_id,
        request_meta=get_request_meta(request),
    )
    return ConsentStatus.model_validate(status_dict)


@router.post(
    "/{consent_type}/withdraw",
    response_model=ConsentStatus,
    status_code=status.HTTP_200_OK,
)
async def withdraw_user_consent(
    request: Request,
    consent_type: ConsentType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentStatus:
    status_dict = await withdraw_consent(
        db=db,
        user_id=current_user.id,
        consent_type=consent_type,
        request_meta=get_request_meta(request),
    )
    return ConsentStatus.model_validate(status_dict)
