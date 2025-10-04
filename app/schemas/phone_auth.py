"""Phone number authentication schemas."""

from pydantic import BaseModel, Field


class PhoneAuthRequest(BaseModel):
    """Request to initiate phone number authentication."""
    phone_number: str = Field(..., regex=r"^\+7\d{10}$", description="Phone number in +7XXXXXXXXXX format")


class PhoneOTPVerifyRequest(BaseModel):
    """Request to verify phone OTP code."""
    phone_number: str = Field(..., regex=r"^\+7\d{10}$")
    otp_code: str = Field(..., min_length=5, max_length=5, pattern=r"^\d{5}$")


class TelegramLoginData(BaseModel):
    """Telegram Login Widget response data."""
    id: int = Field(..., description="Telegram user ID")
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str
