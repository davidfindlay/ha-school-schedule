"""Storage handler for School Schedule."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1


class SchoolScheduleStore:
    """Class to manage School Schedule storage."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the store."""
        self._store: Store = Store(
            hass,
            STORAGE_VERSION,
            f"{DOMAIN}.{entry_id}",
        )

    async def async_load(self) -> dict[str, Any] | None:
        """Load data from storage."""
        return await self._store.async_load()

    async def async_save(self, data: dict[str, Any]) -> None:
        """Save data to storage."""
        await self._store.async_save(data)

    async def async_remove(self) -> None:
        """Remove storage file."""
        await self._store.async_remove()
