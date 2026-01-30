"""Calendar platform for School Schedule - allows viewing schedule in calendar."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, DAYS_OF_WEEK
from .coordinator import SchoolScheduleCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up School Schedule calendar from a config entry."""
    coordinator: SchoolScheduleCoordinator = hass.data[DOMAIN][entry.entry_id]
    
    # Wait for first data load
    if coordinator.data:
        entities = []
        for child_name in coordinator.data.get("children", {}):
            entities.append(SchoolScheduleCalendar(coordinator, entry, child_name))
        async_add_entities(entities)


class SchoolScheduleCalendar(CoordinatorEntity, CalendarEntity):
    """Calendar entity for a child's school schedule."""

    def __init__(
        self,
        coordinator: SchoolScheduleCoordinator,
        entry: ConfigEntry,
        child_name: str,
    ) -> None:
        """Initialize the calendar."""
        super().__init__(coordinator)
        self._entry = entry
        self._child_name = child_name
        self._attr_unique_id = f"{entry.entry_id}_{child_name}_calendar"
        self._attr_name = f"{child_name} School Schedule"

    @property
    def event(self) -> CalendarEvent | None:
        """Return the current or next upcoming event."""
        if not self.coordinator.data:
            return None

        now = dt_util.now()
        today = now.date()

        child_data = self.coordinator.data.get("children", {}).get(self._child_name)
        if not child_data:
            return None

        items_today = child_data.get("items_today", [])
        if not items_today:
            return None

        item_names = ", ".join(item.get("name", "") for item in items_today)

        return CalendarEvent(
            start=today,
            end=today + timedelta(days=1),
            summary=f"{self._child_name}: {item_names}",
            description=f"Items needed: {item_names}",
        )

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_date: datetime,
        end_date: datetime,
    ) -> list[CalendarEvent]:
        """Return calendar events in a date range."""
        events = []

        if not self.coordinator.data:
            return events

        child_data = self.coordinator.data.get("children", {}).get(self._child_name)
        if not child_data:
            return events
        
        current = start_date.date() if isinstance(start_date, datetime) else start_date
        end = end_date.date() if isinstance(end_date, datetime) else end_date
        
        while current <= end:
            items = self._get_items_for_date(child_data, current)
            if items:
                item_names = ", ".join(item.get("name", "") for item in items)
                events.append(CalendarEvent(
                    start=current,
                    end=current + timedelta(days=1),
                    summary=f"{self._child_name}: {item_names}",
                    description=f"Items needed: {item_names}",
                ))
            current += timedelta(days=1)
        
        return events

    def _get_items_for_date(self, child_data: dict, date) -> list[dict]:
        """Get items for a specific date."""
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, 'strftime') else str(date)
        exceptions = child_data.get("exceptions", {})

        if date_str in exceptions:
            item_ids = exceptions[date_str]
        else:
            day_name = DAYS_OF_WEEK[date.weekday()]
            item_ids = child_data.get("weekly_schedule", {}).get(day_name, [])

        # Build item map from child's items AND shared library
        child_items = child_data.get("items", [])
        library_items = self.coordinator.data.get("item_library", [])
        item_map = {item["id"]: item for item in child_items}
        for item in library_items:
            if item["id"] not in item_map:
                item_map[item["id"]] = item

        return [item_map[item_id] for item_id in item_ids if item_id in item_map]

    @property
    def icon(self) -> str:
        """Return the icon."""
        return "mdi:calendar-account"
