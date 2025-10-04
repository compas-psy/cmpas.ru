"""Email-based authentication schemas."""

from pydantic import BaseModel, EmailStr, Field


class EmailAuthRequest(BaseModel):
    """Request to initiate email authentication."""
    email: EmailStr


class EmailOTPVerifyRequest(BaseModel):
    """Request to verify email OTP code."""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
