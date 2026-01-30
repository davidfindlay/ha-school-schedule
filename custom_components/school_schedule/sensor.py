"""Sensor platform for School Schedule."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SchoolScheduleCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up School Schedule sensors from a config entry."""
    coordinator: SchoolScheduleCoordinator = hass.data[DOMAIN][entry.entry_id]

    # Add a master sensor that tracks all children
    entities = [SchoolScheduleMasterSensor(coordinator, entry)]

    async_add_entities(entities)


class SchoolScheduleMasterSensor(
    CoordinatorEntity[SchoolScheduleCoordinator], SensorEntity
):
    """Sensor representing the entire school schedule."""

    def __init__(
        self,
        coordinator: SchoolScheduleCoordinator,
        entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_master"
        self._attr_name = "School Schedule"
        # Explicitly set the entity ID to sensor.school_schedule
        self.entity_id = "sensor.school_schedule"

    @property
    def device_info(self) -> DeviceInfo:
        """Return device info."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name="School Schedule",
            manufacturer="Custom Integration",
            model="School Schedule Manager",
            sw_version="1.0.0",
        )

    @property
    def native_value(self) -> str:
        """Return the state."""
        if self.coordinator.data:
            if self.coordinator.data.get("is_tomorrow"):
                return "Tomorrow"
            return "Today"
        return "unknown"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes."""
        if not self.coordinator.data:
            return {}

        data = self.coordinator.data
        display_date = data.get("display_date")

        # Safely format the date
        formatted_date = None
        if display_date is not None:
            if isinstance(display_date, datetime):
                formatted_date = display_date.strftime("%Y-%m-%d")
            elif isinstance(display_date, str):
                formatted_date = display_date

        attrs: dict[str, Any] = {
            "display_date": formatted_date,
            "is_tomorrow": data.get("is_tomorrow", False),
            "switchover_time": data.get("switchover_time", "12:00"),
            "children": {},
            "item_library": [
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "image": item.get("image"),
                }
                for item in data.get("item_library", [])
            ],
        }

        for child_name, child_data in data.get("children", {}).items():
            attrs["children"][child_name] = {
                "items_today": [
                    {
                        "id": item.get("id"),
                        "name": item.get("name"),
                        "image": item.get("image"),
                    }
                    for item in child_data.get("items_today", [])
                ],
                "all_items": [
                    {
                        "id": item.get("id"),
                        "name": item.get("name"),
                        "image": item.get("image"),
                    }
                    for item in child_data.get("items", [])
                ],
                "weekly_schedule": child_data.get("weekly_schedule", {}),
                "exceptions": child_data.get("exceptions", {}),
            }

        return attrs

    @property
    def icon(self) -> str:
        """Return the icon."""
        return "mdi:bag-personal"
