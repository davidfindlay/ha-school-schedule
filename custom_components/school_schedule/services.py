"""Services for School Schedule integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, DAYS_OF_WEEK

_LOGGER = logging.getLogger(__name__)

SERVICE_ADD_CHILD = "add_child"
SERVICE_REMOVE_CHILD = "remove_child"
SERVICE_ADD_ITEM = "add_item"
SERVICE_REMOVE_ITEM = "remove_item"
SERVICE_UPDATE_ITEM = "update_item"
SERVICE_SET_WEEKLY_SCHEDULE = "set_weekly_schedule"
SERVICE_ADD_EXCEPTION = "add_exception"
SERVICE_REMOVE_EXCEPTION = "remove_exception"
SERVICE_SET_SWITCHOVER_TIME = "set_switchover_time"
SERVICE_ADD_LIBRARY_ITEM = "add_library_item"
SERVICE_REMOVE_LIBRARY_ITEM = "remove_library_item"
SERVICE_UPDATE_LIBRARY_ITEM = "update_library_item"
SERVICE_ASSIGN_LIBRARY_ITEM = "assign_library_item"

ADD_CHILD_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
})

REMOVE_CHILD_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
})

ADD_ITEM_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("item_id"): cv.string,
    vol.Required("item_name"): cv.string,
    vol.Required("image"): cv.string,
})

REMOVE_ITEM_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("item_id"): cv.string,
})

UPDATE_ITEM_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("item_id"): cv.string,
    vol.Optional("item_name"): cv.string,
    vol.Optional("image"): cv.string,
})

SET_WEEKLY_SCHEDULE_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("day"): vol.In(DAYS_OF_WEEK),
    vol.Required("item_ids"): vol.All(cv.ensure_list, [cv.string]),
})

ADD_EXCEPTION_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("date"): cv.string,  # YYYY-MM-DD format
    vol.Required("item_ids"): vol.All(cv.ensure_list, [cv.string]),
})

REMOVE_EXCEPTION_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("date"): cv.string,
})

SET_SWITCHOVER_TIME_SCHEMA = vol.Schema({
    vol.Required("time"): cv.string,  # HH:MM format
})

ADD_LIBRARY_ITEM_SCHEMA = vol.Schema({
    vol.Required("item_id"): cv.string,
    vol.Required("item_name"): cv.string,
    vol.Required("image"): cv.string,
})

REMOVE_LIBRARY_ITEM_SCHEMA = vol.Schema({
    vol.Required("item_id"): cv.string,
})

UPDATE_LIBRARY_ITEM_SCHEMA = vol.Schema({
    vol.Required("item_id"): cv.string,
    vol.Optional("item_name"): cv.string,
    vol.Optional("image"): cv.string,
})

ASSIGN_LIBRARY_ITEM_SCHEMA = vol.Schema({
    vol.Required("child_name"): cv.string,
    vol.Required("item_id"): cv.string,
})


async def async_setup_services(hass: HomeAssistant) -> None:
    """Set up services for School Schedule integration."""

    async def get_coordinator():
        """Get the coordinator from the first config entry."""
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            raise ValueError("School Schedule integration not configured")
        return hass.data[DOMAIN][entries[0].entry_id]

    async def handle_add_child(call: ServiceCall) -> None:
        """Handle add_child service call."""
        coordinator = await get_coordinator()
        await coordinator.async_add_child(call.data["name"])

    async def handle_remove_child(call: ServiceCall) -> None:
        """Handle remove_child service call."""
        coordinator = await get_coordinator()
        await coordinator.async_remove_child(call.data["name"])

    async def handle_add_item(call: ServiceCall) -> None:
        """Handle add_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_add_item(
            call.data["child_name"],
            call.data["item_id"],
            call.data["item_name"],
            call.data["image"],
        )

    async def handle_remove_item(call: ServiceCall) -> None:
        """Handle remove_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_remove_item(
            call.data["child_name"],
            call.data["item_id"],
        )

    async def handle_update_item(call: ServiceCall) -> None:
        """Handle update_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_update_item(
            call.data["child_name"],
            call.data["item_id"],
            call.data.get("item_name"),
            call.data.get("image"),
        )

    async def handle_set_weekly_schedule(call: ServiceCall) -> None:
        """Handle set_weekly_schedule service call."""
        coordinator = await get_coordinator()
        await coordinator.async_set_weekly_schedule(
            call.data["child_name"],
            call.data["day"],
            call.data["item_ids"],
        )

    async def handle_add_exception(call: ServiceCall) -> None:
        """Handle add_exception service call."""
        coordinator = await get_coordinator()
        await coordinator.async_add_exception(
            call.data["child_name"],
            call.data["date"],
            call.data["item_ids"],
        )

    async def handle_remove_exception(call: ServiceCall) -> None:
        """Handle remove_exception service call."""
        coordinator = await get_coordinator()
        await coordinator.async_remove_exception(
            call.data["child_name"],
            call.data["date"],
        )

    async def handle_set_switchover_time(call: ServiceCall) -> None:
        """Handle set_switchover_time service call."""
        coordinator = await get_coordinator()
        await coordinator.async_set_switchover_time(call.data["time"])

    async def handle_add_library_item(call: ServiceCall) -> None:
        """Handle add_library_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_add_library_item(
            call.data["item_id"],
            call.data["item_name"],
            call.data["image"],
        )

    async def handle_remove_library_item(call: ServiceCall) -> None:
        """Handle remove_library_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_remove_library_item(call.data["item_id"])

    async def handle_update_library_item(call: ServiceCall) -> None:
        """Handle update_library_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_update_library_item(
            call.data["item_id"],
            call.data.get("item_name"),
            call.data.get("image"),
        )

    async def handle_assign_library_item(call: ServiceCall) -> None:
        """Handle assign_library_item service call."""
        coordinator = await get_coordinator()
        await coordinator.async_assign_library_item(
            call.data["child_name"],
            call.data["item_id"],
        )

    hass.services.async_register(DOMAIN, SERVICE_ADD_CHILD, handle_add_child, schema=ADD_CHILD_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_REMOVE_CHILD, handle_remove_child, schema=REMOVE_CHILD_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ADD_ITEM, handle_add_item, schema=ADD_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_REMOVE_ITEM, handle_remove_item, schema=REMOVE_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_ITEM, handle_update_item, schema=UPDATE_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_WEEKLY_SCHEDULE, handle_set_weekly_schedule, schema=SET_WEEKLY_SCHEDULE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ADD_EXCEPTION, handle_add_exception, schema=ADD_EXCEPTION_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_REMOVE_EXCEPTION, handle_remove_exception, schema=REMOVE_EXCEPTION_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_SWITCHOVER_TIME, handle_set_switchover_time, schema=SET_SWITCHOVER_TIME_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ADD_LIBRARY_ITEM, handle_add_library_item, schema=ADD_LIBRARY_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_REMOVE_LIBRARY_ITEM, handle_remove_library_item, schema=REMOVE_LIBRARY_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_LIBRARY_ITEM, handle_update_library_item, schema=UPDATE_LIBRARY_ITEM_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ASSIGN_LIBRARY_ITEM, handle_assign_library_item, schema=ASSIGN_LIBRARY_ITEM_SCHEMA)


async def async_unload_services(hass: HomeAssistant) -> None:
    """Unload services."""
    hass.services.async_remove(DOMAIN, SERVICE_ADD_CHILD)
    hass.services.async_remove(DOMAIN, SERVICE_REMOVE_CHILD)
    hass.services.async_remove(DOMAIN, SERVICE_ADD_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_REMOVE_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_UPDATE_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_SET_WEEKLY_SCHEDULE)
    hass.services.async_remove(DOMAIN, SERVICE_ADD_EXCEPTION)
    hass.services.async_remove(DOMAIN, SERVICE_REMOVE_EXCEPTION)
    hass.services.async_remove(DOMAIN, SERVICE_SET_SWITCHOVER_TIME)
    hass.services.async_remove(DOMAIN, SERVICE_ADD_LIBRARY_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_REMOVE_LIBRARY_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_UPDATE_LIBRARY_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_ASSIGN_LIBRARY_ITEM)
