"""Authentication request/response schemas."""

from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    """Request to initiate Telegram authentication."""
    telegram_id: str = Field(..., min_length=1, description="Telegram user ID")
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=32)
    photo_url: Optional[str] = None
    auth_date: int = Field(..., gt=0)
    hash: str = Field(..., min_length=1)


class TelegramOTPVerifyRequest(BaseModel):
    """Request to verify Telegram OTP code."""
    telegram_id: str = Field(..., min_length=1)
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    full_name: str = Field(..., min_length=1, max_length=255)
    username: Optional[str] = Field(None, max_length=32)
