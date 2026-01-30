"""Config flow for School Schedule integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, CONF_SWITCHOVER_TIME, DEFAULT_SWITCHOVER_TIME

_LOGGER = logging.getLogger(__name__)


class SchoolScheduleConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for School Schedule."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        # Only allow one instance
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(
                title="School Schedule",
                data={
                    CONF_SWITCHOVER_TIME: user_input.get(CONF_SWITCHOVER_TIME, DEFAULT_SWITCHOVER_TIME),
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Optional(CONF_SWITCHOVER_TIME, default=DEFAULT_SWITCHOVER_TIME): str,
            }),
            description_placeholders={
                "switchover_description": "Time when the display switches from today to tomorrow (24h format, e.g., 12:00)"
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Get the options flow for this handler."""
        return SchoolScheduleOptionsFlowHandler(config_entry)


class SchoolScheduleOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for School Schedule."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    CONF_SWITCHOVER_TIME,
                    default=self.config_entry.data.get(CONF_SWITCHOVER_TIME, DEFAULT_SWITCHOVER_TIME),
                ): str,
            }),
        )
