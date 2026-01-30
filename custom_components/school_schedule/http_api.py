"""HTTP API for School Schedule integration."""
from __future__ import annotations

import logging
import re
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Allowed image extensions
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

# Max file size (5MB)
MAX_FILE_SIZE = 5 * 1024 * 1024


class SchoolScheduleUploadView(HomeAssistantView):
    """Handle image uploads for school schedule items."""

    url = "/api/school_schedule/upload"
    name = "api:school_schedule:upload"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the view."""
        self._hass = hass

    async def post(self, request: web.Request) -> web.Response:
        """Handle POST request for image upload."""
        try:
            # Get the www directory
            www_dir = Path(self._hass.config.path("www"))
            school_schedule_dir = www_dir / "school-schedule"

            # Create directory if it doesn't exist
            if not school_schedule_dir.exists():
                await self._hass.async_add_executor_job(
                    school_schedule_dir.mkdir, True, True
                )

            # Read the entire post data
            data = await request.post()

            if "file" not in data:
                return web.json_response(
                    {"success": False, "error": "No file provided"},
                    status=400
                )

            file_field = data["file"]

            # Check if it's a file field
            if not hasattr(file_field, "filename") or not file_field.filename:
                return web.json_response(
                    {"success": False, "error": "No filename provided"},
                    status=400
                )

            filename = file_field.filename

            # Validate file extension
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                return web.json_response(
                    {"success": False, "error": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"},
                    status=400
                )

            # Read file content
            content = file_field.file.read()

            # Check file size
            if len(content) > MAX_FILE_SIZE:
                return web.json_response(
                    {"success": False, "error": "File too large (max 5MB)"},
                    status=400
                )

            # Sanitize filename - only allow alphanumeric, dash, underscore
            safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", Path(filename).stem)
            safe_filename = f"{safe_name}{ext}"

            # Save file
            file_path = school_schedule_dir / safe_filename

            # If file exists, add a number suffix
            counter = 1
            while file_path.exists():
                safe_filename = f"{safe_name}_{counter}{ext}"
                file_path = school_schedule_dir / safe_filename
                counter += 1

            await self._hass.async_add_executor_job(
                self._write_file, file_path, content
            )

            # Return the local path for HA
            local_path = f"/local/school-schedule/{safe_filename}"

            _LOGGER.info("Uploaded image: %s (%d bytes)", local_path, len(content))

            return web.json_response({
                "success": True,
                "path": local_path,
                "filename": safe_filename
            })

        except Exception as err:
            _LOGGER.exception("Error uploading image: %s", err)
            return web.json_response(
                {"success": False, "error": str(err)},
                status=500
            )

    @staticmethod
    def _write_file(path: Path, content: bytes) -> None:
        """Write file to disk."""
        with open(path, "wb") as f:
            f.write(content)


async def async_setup_http(hass: HomeAssistant) -> None:
    """Set up HTTP endpoints."""
    hass.http.register_view(SchoolScheduleUploadView(hass))
