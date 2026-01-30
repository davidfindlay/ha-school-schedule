# School Schedule - Home Assistant Integration

[![HACS Validation](https://github.com/davidfindlay/ha-school-schedule/actions/workflows/validate.yml/badge.svg)](https://github.com/davidfindlay/ha-school-schedule/actions/workflows/validate.yml)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

A Home Assistant custom integration that displays what school items each child needs to bring each day, with visual images in a clean card layout.

## Features

- **Visual display card** showing items with images for each child in columns
- **Weekly recurring schedules** - set what's needed each day of the week
- **Date exceptions** - override specific dates for sports carnivals, excursions, holidays
- **Switchover time** - after a configurable time, shows tomorrow's items instead of today's
- **Calendar integration** - view schedules in Home Assistant's calendar
- **Full UI management** - configure everything through the Home Assistant interface

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=davidfindlay&repository=ha-school-schedule&category=integration)

1. Click the button above, or manually: open HACS, click the three dots in the top right corner, select **Custom repositories**, and add `https://github.com/davidfindlay/ha-school-schedule` with category **Integration**
2. Click **Install** on the School Schedule card
3. Restart Home Assistant
4. Go to **Settings > Devices & Services > Add Integration** and search for **School Schedule**

### Manual Installation

1. Copy the `custom_components/school_schedule` folder to your Home Assistant `custom_components/` directory
2. Copy `www/school-schedule-card.js` and `www/school-schedule-panel.js` to your Home Assistant `www/` directory
3. Restart Home Assistant
4. Go to **Settings > Devices & Services > Add Integration** and search for **School Schedule**

### Add Lovelace Resources

After installation (HACS or manual), add the frontend cards as Lovelace resources:

1. Go to **Settings > Dashboards > Resources** (enable advanced mode in your profile if you don't see this)
2. Add the following resources:
   - URL: `/local/school-schedule-card.js` — Type: JavaScript Module
   - URL: `/local/school-schedule-panel.js` — Type: JavaScript Module

Or add them in your Lovelace YAML configuration:

```yaml
resources:
  - url: /local/school-schedule-card.js
    type: module
  - url: /local/school-schedule-panel.js
    type: module
```

## Cards

### Display Card

Shows the visual schedule with item images:

```yaml
type: custom:school-schedule-card
entity: sensor.school_schedule
title: What to Pack Today
show_header: true
show_date: true
show_item_names: true
image_size: 80
columns: auto  # or 1, 2, 3, etc.
# children:    # optional - filter to specific children
#   - Emma
#   - Jack
```

### Management Panel

Full UI for configuring schedules:

```yaml
type: custom:school-schedule-panel
entity: sensor.school_schedule
```

## Services

All management can be done via services:

| Service | Description |
|---------|-------------|
| `school_schedule.add_child` | Add a new child |
| `school_schedule.remove_child` | Remove a child |
| `school_schedule.add_item` | Add an item to a child |
| `school_schedule.remove_item` | Remove an item |
| `school_schedule.update_item` | Update item name/image |
| `school_schedule.set_weekly_schedule` | Set items for a day |
| `school_schedule.add_exception` | Add date exception |
| `school_schedule.remove_exception` | Remove exception |
| `school_schedule.set_switchover_time` | Change switchover time |

### Example: Set up a child's schedule

```yaml
# Add a child
service: school_schedule.add_child
data:
  name: Emma

# Add items
service: school_schedule.add_item
data:
  child_name: Emma
  item_id: formal_uniform
  item_name: Formal Uniform
  image: /local/school/formal.png

service: school_schedule.add_item
data:
  child_name: Emma
  item_id: library_bag
  item_name: Library Bag
  image: /local/school/library.png

# Set Monday schedule
service: school_schedule.set_weekly_schedule
data:
  child_name: Emma
  day: monday
  item_ids:
    - formal_uniform
    - library_bag

# Add an exception for a special day
service: school_schedule.add_exception
data:
  child_name: Emma
  date: "2025-03-15"
  item_ids:
    - sports_uniform  # Sports carnival that day
```

## Image Setup

Place your images in the `www` folder of your Home Assistant config:

```
/config/www/school/
  ├── formal-uniform.png
  ├── sports-uniform.png
  ├── library-bag.png
  ├── swimming-bag.png
  └── violin.png
```

Reference them as `/local/school/formal-uniform.png` in the integration.

**Tips:**
- Use PNG or SVG for best quality
- Square images work best (e.g., 200x200)
- Keep file sizes small for fast loading

## How It Works

### Switchover Time

By default, the card shows today's items until noon (12:00), then switches to show tomorrow's items. This helps with evening preparation.

Configure via:
- The integration options
- `school_schedule.set_switchover_time` service

### Weekly Schedule

Set which items are needed for each day of the week. This repeats every week automatically.

### Exceptions

Override specific dates when the regular schedule doesn't apply:
- Sports carnivals
- Excursions
- School holidays (set empty item list)
- Special events

## Development

### Docker Test Environment

Prerequisites: Docker and Docker Compose installed, port 8123 available.

```bash
./scripts/start.sh    # Start the environment
./scripts/stop.sh     # Stop the environment
./scripts/logs.sh     # View logs
```

Wait 30-60 seconds for Home Assistant to start, then open http://localhost:8123

1. Create an admin account when prompted
2. Go to **Settings > Devices & Services > Add Integration** and search for **School Schedule**
3. Set the switchover time (default: 12:00 = noon)

The test environment includes a pre-configured dashboard with the display card, management panel, calendar view, and service examples.

To populate sample data:

```bash
export HA_TOKEN='your_token_here'
./scripts/setup-test-data.sh
```

### Project structure

```
ha-school-schedule/
├── custom_components/school_schedule/
│   ├── __init__.py         # Integration setup
│   ├── manifest.json       # Integration metadata
│   ├── const.py            # Constants
│   ├── config_flow.py      # UI configuration
│   ├── coordinator.py      # Data management
│   ├── store.py            # Persistent storage
│   ├── sensor.py           # Main sensor entity
│   ├── calendar.py         # Calendar entities
│   ├── services.py         # Service handlers
│   ├── services.yaml       # Service definitions
│   └── translations/
│       └── en.json         # English translations
├── www/
│   ├── school-schedule-card.js    # Display card
│   ├── school-schedule-panel.js   # Management panel
│   └── test-images/               # Sample images
├── test-config/                    # Docker test config
├── docker-compose.yml
└── scripts/
    ├── start.sh
    ├── stop.sh
    ├── logs.sh
    └── setup-test-data.sh
```

### Live development

The Docker setup mounts the source files directly, so changes to:
- `custom_components/school_schedule/*` - Restart HA to apply
- `www/*.js` - Hard refresh browser (Cmd+Shift+R)

### View logs

```bash
./scripts/logs.sh
# or
docker-compose logs -f
```

## License

MIT
