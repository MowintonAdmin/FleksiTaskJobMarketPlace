"""Helper utilities for historical data import operations."""

import re
from typing import Optional


def generate_import_email(participant_id: str) -> str:
    """Generate a placeholder email for imported workers without an existing account.

    The format can be changed here without modifying any import logic elsewhere.
    Workers who later register via the app will have this email replaced.

    Args:
        participant_id: The legacy Participant ID from the source data (e.g., '30267').

    Returns:
        A unique placeholder email string.
    """
    # Sanitize the participant ID to ensure it's email-safe
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', str(participant_id).strip())
    return f"legacy-{sanitized}@import.local"


def parse_import_participant_id(raw_id: Optional[str]) -> Optional[str]:
    """Clean and normalize a legacy participant ID from source data."""
    if not raw_id:
        return None
    cleaned = str(raw_id).strip()
    if cleaned in ("", "#N/A", "N/A", "0"):
        return None
    return cleaned


def parse_import_phone(raw_phone: Optional[str]) -> Optional[str]:
    """Clean and normalize a phone number from source data."""
    if not raw_phone:
        return None
    cleaned = str(raw_phone).strip()
    if cleaned in ("", "#N/A", "N/A", "-", "0"):
        return None
    return cleaned