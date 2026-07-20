import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
import json
from urllib.parse import quote, urlparse


def normalize_profile_photo_url(url: str | None) -> str | None:
    if not url or url.startswith("/"):
        return url

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not host:
        return url

    if host.endswith("googleusercontent.com") or host == "google.com" or host.endswith(".google.com"):
        return f"/api/v1/users/photo-proxy?url={quote(url, safe='')}"

    return url


class UserBase(BaseModel):
    email: str  # String to support imported worker placeholder emails (e.g. legacy-xxx@import.local)
    full_name: str
    bio: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    skills: list[str] | None = None
    academic_qualification: str | None = None
    body_height_cm: float | None = None
    nationality: str | None = None
    race: str | None = None
    nric_passport: str | None = None
    bank_qr_code_url: str | None = None

    @field_validator("skills", mode="before")
    @classmethod
    def parse_skills(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


class UserCreate(UserBase):
    password: str | None = None
    google_id: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    bio: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    skills: list[str] | None = None
    phone: str | None = None
    academic_qualification: str | None = None
    body_height_cm: float | None = None
    nationality: str | None = None
    race: str | None = None
    nric_passport: str | None = None
    bank_qr_code_url: str | None = None


class UserResponse(UserBase):
    id: uuid.UUID
    profile_photo_url: str | None = None
    phone: str | None = None
    phone_verified: bool = False
    id_photo_front_url: str | None = None
    selfie_with_id_url: str | None = None
    verification_status: str = "pending"
    rejection_reason: str | None = None
    verification_submitted_at: datetime | None = None
    is_active: bool
    is_employer: bool
    is_admin: bool
    is_super_admin: bool
    company_tag: str | None = None
    is_verified: bool
    source: str | None = None
    legacy_participant_id: str | None = None
    has_password: bool = False
    created_at: datetime

    @field_validator("profile_photo_url", mode="before")
    @classmethod
    def normalize_profile_photo(cls, value):
        return normalize_profile_photo_url(value)

    @field_validator("has_password", mode="before")
    @classmethod
    def compute_has_password(cls, value, info):
        # When created via from_attributes, check if the ORM model has hashed_password
        if isinstance(value, bool):
            return value
        return False

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: uuid.UUID
    full_name: str
    profile_photo_url: str | None = None
    location: str | None = None
    skills: list[str] | None = None

    @field_validator("skills", mode="before")
    @classmethod
    def parse_skills(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("profile_photo_url", mode="before")
    @classmethod
    def normalize_profile_photo(cls, value):
        return normalize_profile_photo_url(value)

    model_config = {"from_attributes": True}


class FCMTokenUpdate(BaseModel):
    fcm_token: str
