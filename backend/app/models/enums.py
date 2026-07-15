from enum import Enum


class DataSource(str, Enum):
    """Source of a record — distinguishes imported historical data from app-generated data."""
    APP = "APP"          # Created by the FlekxiTask application (normal flow)
    IMPORTED = "IMPORTED"  # Imported from historical/external data (e.g., Excel workbook)
    API = "API"          # Created via external API integration