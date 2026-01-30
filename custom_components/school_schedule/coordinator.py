"""Data coordinator for School Schedule."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    DEFAULT_SWITCHOVER_TIME,
    DAYS_OF_WEEK,
)
from .store import SchoolScheduleStore

_LOGGER = logging.getLogger(__name__)


class SchoolScheduleCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage school schedule data."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=1),
        )
        self.config_entry = entry
        self.store = SchoolScheduleStore(hass, entry.entry_id)
        self._data: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from storage and compute current items."""
        stored_data = await self.store.async_load()
        if stored_data is None:
            stored_data = {
                "children": [],
                "item_library": [],
                "switchover_time": DEFAULT_SWITCHOVER_TIME,
            }

        # Ensure item_library exists for older data
        if "item_library" not in stored_data:
            stored_data["item_library"] = []

        self._data = stored_data
        switchover_time = stored_data.get("switchover_time", DEFAULT_SWITCHOVER_TIME)

        # Compute which items are needed for each child
        result: dict[str, Any] = {
            "children": {},
            "item_library": stored_data.get("item_library", []),
            "switchover_time": switchover_time,
            "display_date": self._get_display_date(switchover_time),
            "is_tomorrow": self._is_showing_tomorrow(switchover_time),
        }

        library = stored_data.get("item_library", [])
        for child in stored_data.get("children", []):
            child_name = child.get("name", "Unknown")
            items_today = self._get_items_for_date(child, result["display_date"], library)
            result["children"][child_name] = {
                "name": child_name,
                "items": child.get("items", []),
                "items_today": items_today,
                "weekly_schedule": child.get("weekly_schedule", {}),
                "exceptions": child.get("exceptions", {}),
            }

        return result

    def _get_switchover_time(self, switchover_str: str) -> time:
        """Parse switchover time string to time object."""
        try:
            parts = switchover_str.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return time(hour, minute)
            return time(12, 0)
        except (ValueError, IndexError, TypeError):
            return time(12, 0)

    def _is_showing_tomorrow(self, switchover_str: str) -> bool:
        """Check if we should show tomorrow's schedule."""
        now = dt_util.now()
        switchover = self._get_switchover_time(switchover_str)
        return now.time() >= switchover

    def _get_display_date(self, switchover_str: str) -> datetime:
        """Get the date to display items for."""
        now = dt_util.now()
        if self._is_showing_tomorrow(switchover_str):
            return now + timedelta(days=1)
        return now

    def _get_items_for_date(
        self, child: dict[str, Any], date: datetime, library: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Get the items needed for a specific date."""
        date_str = date.strftime("%Y-%m-%d")
        exceptions = child.get("exceptions", {})

        # Check for exception first
        if date_str in exceptions:
            exception_item_ids = exceptions[date_str]
            return self._get_items_by_ids(child, exception_item_ids, library)

        # Use weekly schedule
        day_name = DAYS_OF_WEEK[date.weekday()]
        weekly_schedule = child.get("weekly_schedule", {})
        item_ids = weekly_schedule.get(day_name, [])

        return self._get_items_by_ids(child, item_ids, library)

    def _get_items_by_ids(
        self, child: dict[str, Any], item_ids: list[str], library: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Get item details by their IDs from child items and library."""
        # Build a map of all available items (child items + library)
        child_items = child.get("items", [])
        item_map = {item["id"]: item for item in child_items}
        # Library items (don't overwrite child items with same ID)
        for item in library:
            if item["id"] not in item_map:
                item_map[item["id"]] = item
        return [item_map[item_id] for item_id in item_ids if item_id in item_map]

    def _find_child(
        self, data: dict[str, Any], child_name: str
    ) -> dict[str, Any] | None:
        """Find a child by name."""
        for child in data.get("children", []):
            if child.get("name") == child_name:
                return child
        return None

    async def _async_modify_data(
        self, modifier: callable[[dict[str, Any]], None]
    ) -> None:
        """Thread-safe data modification with lock."""
        async with self._lock:
            data = await self.store.async_load() or {
                "children": [],
                "item_library": [],
                "switchover_time": DEFAULT_SWITCHOVER_TIME,
            }
            # Ensure item_library exists
            if "item_library" not in data:
                data["item_library"] = []
            modifier(data)
            self._data = data
            await self.store.async_save(data)
        await self.async_refresh()

    async def async_add_child(self, name: str) -> None:
        """Add a new child."""

        def modifier(data: dict[str, Any]) -> None:
            # Check for duplicate
            if any(c.get("name") == name for c in data.get("children", [])):
                raise HomeAssistantError(f"Child '{name}' already exists")
            data["children"].append(
                {
                    "name": name,
                    "items": [],
                    "weekly_schedule": {day: [] for day in DAYS_OF_WEEK},
                    "exceptions": {},
                }
            )
            _LOGGER.info("Added child: %s", name)

        await self._async_modify_data(modifier)

    async def async_remove_child(self, name: str) -> None:
        """Remove a child."""

        def modifier(data: dict[str, Any]) -> None:
            original_count = len(data.get("children", []))
            data["children"] = [c for c in data["children"] if c.get("name") != name]
            if len(data["children"]) == original_count:
                raise HomeAssistantError(f"Child '{name}' not found")
            _LOGGER.info("Removed child: %s", name)

        await self._async_modify_data(modifier)

    async def async_add_item(
        self, child_name: str, item_id: str, item_name: str, image: str
    ) -> None:
        """Add an item to a child."""

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")
            # Check for duplicate item ID
            if any(item.get("id") == item_id for item in child.get("items", [])):
                raise HomeAssistantError(
                    f"Item with ID '{item_id}' already exists for {child_name}"
                )
            child["items"].append(
                {
                    "id": item_id,
                    "name": item_name,
                    "image": image,
                }
            )
            _LOGGER.info("Added item '%s' to child '%s'", item_name, child_name)

        await self._async_modify_data(modifier)

    async def async_remove_item(self, child_name: str, item_id: str) -> None:
        """Remove an item from a child."""

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            original_count = len(child.get("items", []))
            child["items"] = [i for i in child["items"] if i.get("id") != item_id]

            if len(child["items"]) == original_count:
                raise HomeAssistantError(
                    f"Item '{item_id}' not found for child '{child_name}'"
                )

            # Also remove from schedules
            for day in DAYS_OF_WEEK:
                if item_id in child.get("weekly_schedule", {}).get(day, []):
                    child["weekly_schedule"][day].remove(item_id)

            # And exceptions
            for date_str in list(child.get("exceptions", {}).keys()):
                if item_id in child["exceptions"][date_str]:
                    child["exceptions"][date_str].remove(item_id)

            _LOGGER.info("Removed item '%s' from child '%s'", item_id, child_name)

        await self._async_modify_data(modifier)

    async def async_update_item(
        self,
        child_name: str,
        item_id: str,
        item_name: str | None = None,
        image: str | None = None,
    ) -> None:
        """Update an item for a child."""

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            for item in child.get("items", []):
                if item.get("id") == item_id:
                    if item_name is not None:
                        item["name"] = item_name
                    if image is not None:
                        item["image"] = image
                    _LOGGER.info(
                        "Updated item '%s' for child '%s'", item_id, child_name
                    )
                    return

            raise HomeAssistantError(
                f"Item '{item_id}' not found for child '{child_name}'"
            )

        await self._async_modify_data(modifier)

    async def async_set_weekly_schedule(
        self, child_name: str, day: str, item_ids: list[str]
    ) -> None:
        """Set the weekly schedule for a child on a specific day."""
        if day not in DAYS_OF_WEEK:
            raise HomeAssistantError(
                f"Invalid day '{day}'. Must be one of: {', '.join(DAYS_OF_WEEK)}"
            )

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            if "weekly_schedule" not in child:
                child["weekly_schedule"] = {d: [] for d in DAYS_OF_WEEK}

            # Validate item IDs exist (in child's items OR shared library)
            child_item_ids = {item.get("id") for item in child.get("items", [])}
            library_item_ids = {item.get("id") for item in data.get("item_library", [])}
            valid_ids = child_item_ids | library_item_ids
            invalid_ids = set(item_ids) - valid_ids
            if invalid_ids:
                raise HomeAssistantError(
                    f"Invalid item IDs for {child_name}: {', '.join(invalid_ids)}"
                )

            child["weekly_schedule"][day] = list(item_ids)
            _LOGGER.info("Set %s schedule for '%s': %s", day, child_name, item_ids)

        await self._async_modify_data(modifier)

    async def async_add_exception(
        self, child_name: str, date_str: str, item_ids: list[str]
    ) -> None:
        """Add an exception for a specific date."""
        # Validate date format
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError as err:
            raise HomeAssistantError(
                f"Invalid date format '{date_str}'. Use YYYY-MM-DD."
            ) from err

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            if "exceptions" not in child:
                child["exceptions"] = {}

            # Validate item IDs exist (empty list is allowed for "no school" days)
            if item_ids:
                child_item_ids = {item.get("id") for item in child.get("items", [])}
                library_item_ids = {item.get("id") for item in data.get("item_library", [])}
                valid_ids = child_item_ids | library_item_ids
                invalid_ids = set(item_ids) - valid_ids
                if invalid_ids:
                    raise HomeAssistantError(
                        f"Invalid item IDs for {child_name}: {', '.join(invalid_ids)}"
                    )

            child["exceptions"][date_str] = list(item_ids)
            _LOGGER.info(
                "Added exception for '%s' on %s: %s", child_name, date_str, item_ids
            )

        await self._async_modify_data(modifier)

    async def async_remove_exception(self, child_name: str, date_str: str) -> None:
        """Remove an exception."""

        def modifier(data: dict[str, Any]) -> None:
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            if date_str not in child.get("exceptions", {}):
                raise HomeAssistantError(
                    f"No exception found for '{child_name}' on {date_str}"
                )

            del child["exceptions"][date_str]
            _LOGGER.info("Removed exception for '%s' on %s", child_name, date_str)

        await self._async_modify_data(modifier)

    async def async_set_switchover_time(self, switchover_time: str) -> None:
        """Set the switchover time."""
        # Validate time format
        parsed = self._get_switchover_time(switchover_time)
        normalized = f"{parsed.hour:02d}:{parsed.minute:02d}"

        def modifier(data: dict[str, Any]) -> None:
            data["switchover_time"] = normalized
            _LOGGER.info("Set switchover time to %s", normalized)

        await self._async_modify_data(modifier)

    # Item Library methods

    async def async_add_library_item(
        self, item_id: str, item_name: str, image: str
    ) -> None:
        """Add an item to the shared library."""

        def modifier(data: dict[str, Any]) -> None:
            library = data.get("item_library", [])
            # Check for duplicate item ID
            if any(item.get("id") == item_id for item in library):
                raise HomeAssistantError(
                    f"Item with ID '{item_id}' already exists in library"
                )
            library.append({
                "id": item_id,
                "name": item_name,
                "image": image,
            })
            data["item_library"] = library
            _LOGGER.info("Added library item: %s", item_name)

        await self._async_modify_data(modifier)

    async def async_remove_library_item(self, item_id: str) -> None:
        """Remove an item from the shared library."""

        def modifier(data: dict[str, Any]) -> None:
            library = data.get("item_library", [])
            original_count = len(library)
            data["item_library"] = [i for i in library if i.get("id") != item_id]

            if len(data["item_library"]) == original_count:
                raise HomeAssistantError(f"Library item '{item_id}' not found")

            _LOGGER.info("Removed library item: %s", item_id)

        await self._async_modify_data(modifier)

    async def async_update_library_item(
        self,
        item_id: str,
        item_name: str | None = None,
        image: str | None = None,
    ) -> None:
        """Update a library item."""

        def modifier(data: dict[str, Any]) -> None:
            library = data.get("item_library", [])

            for item in library:
                if item.get("id") == item_id:
                    if item_name is not None:
                        item["name"] = item_name
                    if image is not None:
                        item["image"] = image
                    _LOGGER.info("Updated library item: %s", item_id)
                    return

            raise HomeAssistantError(f"Library item '{item_id}' not found")

        await self._async_modify_data(modifier)

    async def async_assign_library_item(
        self, child_name: str, item_id: str
    ) -> None:
        """Assign a library item to a child (copies item to child's items)."""

        def modifier(data: dict[str, Any]) -> None:
            # Find the library item
            library = data.get("item_library", [])
            library_item = None
            for item in library:
                if item.get("id") == item_id:
                    library_item = item
                    break

            if not library_item:
                raise HomeAssistantError(f"Library item '{item_id}' not found")

            # Find the child
            child = self._find_child(data, child_name)
            if not child:
                raise HomeAssistantError(f"Child '{child_name}' not found")

            # Check if already assigned
            if any(i.get("id") == item_id for i in child.get("items", [])):
                raise HomeAssistantError(
                    f"Item '{item_id}' already assigned to {child_name}"
                )

            # Copy the item to the child
            child["items"].append({
                "id": library_item["id"],
                "name": library_item["name"],
                "image": library_item["image"],
            })
            _LOGGER.info(
                "Assigned library item '%s' to child '%s'",
                item_id, child_name
            )

        await self._async_modify_data(modifier)
