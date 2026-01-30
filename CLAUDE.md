# School Schedule - Home Assistant Integration

## Project Overview

A Home Assistant custom integration that displays school items (uniforms, bags, instruments, etc.) each child needs to bring each day. Features visual cards with images, weekly recurring schedules, date-based exceptions, a shared item library, image uploads, and calendar integration per child.

## Directory Structure

```
ha-school-schedule/
├── custom_components/school_schedule/   # HA integration backend
│   ├── __init__.py                      # Integration setup, entry points, upload API
│   ├── manifest.json                    # Integration metadata
│   ├── const.py                         # Constants (DOMAIN, days, defaults)
│   ├── config_flow.py                   # UI configuration flow
│   ├── coordinator.py                   # Data management with async lock
│   ├── store.py                         # Persistent JSON storage
│   ├── sensor.py                        # Main sensor entity
│   ├── calendar.py                      # Calendar entities per child
│   ├── services.py                      # Service handlers (13 services)
│   ├── services.yaml                    # Service definitions for UI
│   └── translations/en.json             # English translations
├── www/                                 # Frontend Lovelace cards
│   ├── school-schedule-card.js          # Display card (shows items)
│   ├── school-schedule-panel.js         # Management panel (CRUD UI) - v1.0.12
│   └── test-images/*.svg                # Sample item images
├── test-config/                         # Docker test HA config
│   ├── configuration.yaml               # Cache bust via ?v=X.X.X on resources
│   └── ui-lovelace.yaml
├── scripts/                             # Helper scripts
│   ├── start.sh                         # Start Docker environment
│   ├── stop.sh                          # Stop Docker environment
│   ├── logs.sh                          # View HA logs
│   └── setup-test-data.sh               # Populate sample data via API
└── docker-compose.yml                   # Docker test environment
```

## Key Technical Details

### Backend (Python)

- **Coordinator pattern**: `SchoolScheduleCoordinator` manages all data with an `asyncio.Lock` for thread-safe modifications
- **Storage**: Uses HA's `helpers.storage.Store` for persistent JSON in `.storage/`
- **Services**: 13 services for managing children, items, library items, schedules, exceptions, switchover time
- **Entities**: One master sensor (`sensor.school_schedule`) + calendar entity per child
- **Sensor attributes**: Exposes `children` (with `items_today`, `all_items`, `weekly_schedule`, `exceptions` per child), `item_library`, `display_date`, `is_tomorrow`, `switchover_time`
- **Calendar**: Each child gets a `calendar.{child_name}_school_schedule` entity; `_get_items_for_date` merges child items + shared library items
- **Image upload**: `POST /api/school_schedule/upload` endpoint (multipart form, requires auth token)

### Frontend (JavaScript)

- **Custom elements**: `school-schedule-card` (display) and `school-schedule-panel` (management)
- **XSS protection**: All user data escaped via `_escapeHtml()` and `_escapeAttr()`
- **Shadow DOM**: Both cards use Shadow DOM for style encapsulation
- **CSS**: Hardcoded colors instead of CSS variables for button styles (Shadow DOM inheritance issues)
- **Item IDs**: Auto-generated from display name (`_generateItemId`) - lowercase, underscores, dedup with numeric suffix
- **Confirmation modals**: Custom HA-style modal (`_showConfirmModal`) replaces native `confirm()` dialogs
- **Schedule/Exceptions UI**: Two-table pattern - "Items Scheduled" (with Remove) and "Items Available" (with Add)
- **Exception editing**: In-memory state (`_selectedExceptionDate`, `_exceptionItemIds`) with Save/Cancel; auto-populates from weekly schedule defaults when creating new exceptions; past exceptions filtered from view

### Data Model

```json
{
  "children": [
    {
      "name": "Emma",
      "items": [
        {"id": "formal", "name": "Formal Uniform", "image": "/local/..."}
      ],
      "weekly_schedule": {
        "monday": ["formal", "library"],
        "tuesday": ["sports"]
      },
      "exceptions": {
        "2025-03-15": ["sports"]
      }
    }
  ],
  "item_library": [
    {"id": "hat", "name": "School Hat", "image": "/local/..."}
  ],
  "switchover_time": "12:00"
}
```

### Services

| Service | Description |
|---------|-------------|
| `add_child` | Add a new child |
| `remove_child` | Remove a child and all their data |
| `add_item` | Add an item to a specific child |
| `remove_item` | Remove an item from a child |
| `update_item` | Update item name/image |
| `set_weekly_schedule` | Set items for a day of the week |
| `add_exception` | Add/update date exception |
| `remove_exception` | Remove a date exception |
| `set_switchover_time` | Change the switchover time |
| `add_library_item` | Add a shared library item |
| `remove_library_item` | Remove a shared library item |
| `update_library_item` | Update a shared library item |
| `assign_library_item` | Assign a library item to a child |

## Development Workflow

### Start test environment
```bash
./scripts/start.sh
# Access at http://localhost:8123
```

### After Python changes
Restart HA: Settings > System > Restart

### After JS changes
1. Bump the `?v=X.X.X` version in `test-config/configuration.yaml`
2. Hard refresh browser: Cmd+Shift+R

### View logs
```bash
./scripts/logs.sh
# Or filter: docker compose logs -f | grep school_schedule
```

### Load sample data
```bash
export HA_TOKEN='your_long_lived_token'
./scripts/setup-test-data.sh
```

## Common Tasks

### Add a new service
1. Add method to `coordinator.py`
2. Add handler in `services.py`
3. Add schema in `services.py`
4. Add definition in `services.yaml`
5. Add translation in `translations/en.json`

### Add a new entity attribute
1. Modify `_async_update_data()` in `coordinator.py`
2. Update `extra_state_attributes` in `sensor.py`
3. Update JS cards if needed

### Modify the management panel UI
1. Edit `www/school-schedule-panel.js`
2. Update `_renderXxxTab()` for HTML changes
3. Update `_attachEventListeners()` for new buttons/actions
4. Add handler methods as needed
5. Bump version comment and `configuration.yaml` cache bust

## Testing Checklist

- [ ] Integration installs without errors
- [ ] Can add/remove children via panel
- [ ] Can add/remove items with images (both per-child and shared library)
- [ ] Image upload works
- [ ] Weekly schedule two-table UI works (add/remove items)
- [ ] Exceptions tab: can create, edit, and remove exceptions
- [ ] Exceptions auto-populate with weekly schedule defaults for the selected day
- [ ] Past exceptions are filtered from the exceptions list
- [ ] Switchover time works (shows tomorrow after configured time)
- [ ] Card displays correct items for current day
- [ ] Calendar shows events (includes both child and shared library items)
- [ ] Confirmation modals appear for all remove actions
