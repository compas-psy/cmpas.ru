from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    try:
        user_id = int(sub)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is inactive")
    return user
