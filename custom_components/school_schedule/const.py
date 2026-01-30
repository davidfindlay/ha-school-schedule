"""Constants for School Schedule integration."""

DOMAIN = "school_schedule"

# Configuration keys
CONF_CHILDREN = "children"
CONF_CHILD_NAME = "name"
CONF_CHILD_ITEMS = "items"
CONF_ITEM_ID = "id"
CONF_ITEM_NAME = "name"
CONF_ITEM_IMAGE = "image"
CONF_WEEKLY_SCHEDULE = "weekly_schedule"
CONF_EXCEPTIONS = "exceptions"
CONF_SWITCHOVER_TIME = "switchover_time"

# Defaults
DEFAULT_SWITCHOVER_TIME = "12:00"

# Days of week
DAYS_OF_WEEK = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

# Services
SERVICE_ADD_EXCEPTION = "add_exception"
SERVICE_REMOVE_EXCEPTION = "remove_exception"
SERVICE_SET_SCHEDULE = "set_schedule"
