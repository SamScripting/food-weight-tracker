# Food & Weight Tracker

A self-hosted food and weight tracking web app built with Flask, SQLite, and vanilla JS.

## Stack

- **Backend:** Python 3 + Flask
- **Database:** SQLite (single file, no server required)
- **Frontend:** Plain HTML + vanilla JavaScript

## Project Structure

```
weight-tracker/
├── app.py
├── database.py
├── requirements.txt
├── weight_tracker.db       # auto-created on first run
├── static/
│   └── app.js
└── templates/
    └── index.html
```

## Setup (Proxmox LXC — Debian/Ubuntu container)

### 1. Install dependencies

```bash
apt update && apt install -y python3 python3-pip python3-venv git
```

### 2. Clone / copy project files

```bash
mkdir -p /opt/weight-tracker && cd /opt/weight-tracker
# copy files here, or: git clone <your-repo> .
```

### 3. Create virtualenv and install packages

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run (development)

```bash
source venv/bin/activate
python app.py
```

App is available at `http://<container-ip>:5000`

---

## Running as a systemd service (persistent)

Create `/etc/systemd/system/weight-tracker.service`:

```ini
[Unit]
Description=Food & Weight Tracker
After=network.target

[Service]
WorkingDirectory=/opt/weight-tracker
ExecStart=/opt/weight-tracker/venv/bin/python app.py
Restart=always
Environment=DB_PATH=/opt/weight-tracker/weight_tracker.db

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
systemctl daemon-reload
systemctl enable --now weight-tracker
```

---

## API Reference

### Foods
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/foods` | List all foods |
| POST | `/api/foods` | Add a food `{name, calories_per_serving, protein_per_serving}` |
| PUT | `/api/foods/<id>` | Update a food |
| DELETE | `/api/foods/<id>` | Delete a food (fails if referenced in log) |

### Food Log
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/log?date=YYYY-MM-DD` | Get log entries for a date |
| POST | `/api/log` | Add entry `{date, food_id, servings}` |
| PUT | `/api/log/<id>` | Update servings `{servings}` |
| DELETE | `/api/log/<id>` | Remove entry |

### Weight
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/weight?date=YYYY-MM-DD` | Get weight for a date |
| POST | `/api/weight` | Upsert weight `{date, weight_lbs}` |

### Summary
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/summary` | All dates with totals (calories, protein, weight) |
# Food & Weight Tracker

A self-hosted food and weight tracking web app built with Flask, SQLite, and vanilla JavaScript. Designed as a personal productivity tool and portfolio project demonstrating REST API design, relational database modeling, and frontend development without frameworks.

## Stack

- **Backend:** Python 3 + Flask (REST API)
- **Database:** SQLite (single file, zero config)
- **Frontend:** Plain HTML + vanilla JavaScript (no build step)

## Features

### Daily Log
- Date picker defaulting to today; navigate to any past date or click a row in Summary to jump directly
- Log foods by searching an autocomplete dropdown (type to filter, arrow keys to navigate, Enter to select)
- Servings field auto-saves on change — no submit button needed
- Weight entry auto-saves on blur
- Live totals bar showing calories, protein, and weight for the day
- Food entries sorted alphabetically
- Inline ❌ to remove entries

### Summary
- Time range filter for charts: 1M / 3M / 6M / 1Y / All
- Weekly weight line chart (Monday entries)
- Daily calories bar chart (historical only)
- Full history table with date, calories, protein, and weight
- Click any row to open that date in Daily Log

### Food Database
- Add foods with name, calories/serving, and protein/serving
- Names are normalized to title case automatically
- Case-insensitive duplicate prevention
- All fields editable inline; auto-save on blur
- Enter key submits new food from any field
- Alphabetically sorted

### General
- All tables scroll independently within the viewport
- Duplicate food entries per day are blocked with a helpful error
- Dates displayed as M/D/YYYY throughout

## Project Structure

```
food-weight-tracker/
├── app.py                  # Flask app + all REST API routes
├── database.py             # DB initialization and connection helper
├── requirements.txt        # Python dependencies
├── weight_tracker.db       # SQLite database (auto-created, gitignored)
├── static/
│   └── app.js              # All frontend logic
└── templates/
    └── index.html          # Single-page UI
```

## API Reference

### Foods
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/foods` | List all foods (alphabetical) |
| POST | `/api/foods` | Add a food `{name, calories_per_serving, protein_per_serving}` |
| PUT | `/api/foods/<id>` | Update a food |
| DELETE | `/api/foods/<id>` | Delete a food (blocked if referenced in log) |

### Food Log
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/log?date=YYYY-MM-DD` | Get log entries for a date |
| POST | `/api/log` | Add entry `{date, food_id, servings}` |
| PUT | `/api/log/<id>` | Update servings `{servings}` |
| DELETE | `/api/log/<id>` | Remove entry |

### Weight
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/weight?date=YYYY-MM-DD` | Get weight for a date |
| POST | `/api/weight` | Upsert weight `{date, weight_lbs}` |

### Summary
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/summary` | All dates with computed totals (calories, protein, weight) |

## Setup

### Requirements
- Python 3.10+
- pip

### Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/food-weight-tracker.git
cd food-weight-tracker

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run
python app.py
```

App available at `http://localhost:5000`

### Proxmox LXC (Debian/Ubuntu container)

```bash
apt update && apt install -y python3 python3-pip python3-venv git
git clone https://github.com/YOUR_USERNAME/food-weight-tracker.git /opt/food-weight-tracker
cd /opt/food-weight-tracker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Running as a systemd service

Create `/etc/systemd/system/food-tracker.service`:

```ini
[Unit]
Description=Food & Weight Tracker
After=network.target

[Service]
WorkingDirectory=/opt/food-weight-tracker
ExecStart=/opt/food-weight-tracker/venv/bin/python app.py
Restart=always
Environment=DB_PATH=/opt/food-weight-tracker/weight_tracker.db

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now food-tracker
```
