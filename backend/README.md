# Alarmy for Travelling — Backend API

A production-ready **FastAPI** backend for **Alarmy for Travelling**, a smart destination-based travel alarm app. Instead of setting a fixed clock alarm that breaks when trains, buses, or cars are delayed, users set their **destination** and a **wake-up buffer** (e.g., *"wake me 30 minutes before reaching Bangalore"*). The backend continuously tracks route ETA and dynamically adjusts the scheduled alarm time.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------+
|                        Mobile / Web Client                            |
|   - Searches destinations       - Starts & monitors journeys          |
|   - Natural language prompt     - Polls / receives updated alarm time |
+-----------------------------------+-----------------------------------+
                                    |
                                    | HTTPS / REST (Bearer JWT)
                                    v
+-----------------------------------------------------------------------+
|                       FastAPI Backend (app.main)                      |
|                                                                       |
|  +---------------+  +---------------+  +---------------+  +--------+  |
|  |  /api/v1/auth |  | /destinations |  |   /journeys   |  |  /ai   |  |
|  +-------+-------+  +-------+-------+  +-------+-------+  +----+---+  |
|          |                  |                  |               |      |
|          v                  v                  v               v      |
|  +---------------+  +---------------+  +---------------+  +--------+  |
|  | Security/JWT  |  | Destination   |  | Journey & ETA |  |AI Parse|  |
|  | (python-jose) |  |   Service     |  |   Services    |  |Service |  |
|  +-------+-------+  +-------+-------+  +-------+-------+  +----+---+  |
+----------|------------------|------------------|---------------|------+
           |                  |                  |               |
           |                  |                  |               +----> OpenAI API
           |                  |                  |                      (gpt-4o-mini + fallback)
           |                  |                  +--------------------> OSRM Routing API
           |                  |                  |                      (Driving ETA)
           |                  +------------------|--------------------> Nominatim API
           |                                     |                      (OSM Geocoding)
           v                                     v
+----------------------+              +---------------------------------+
|   PostgreSQL 15 DB   |<------------+|   Celery Worker + Celery Beat   |
|  (SQLAlchemy Async)  |              |  - Periodic task every 300s     |
|  - users             |              |  - Polls active journeys        |
|  - destinations      |              |  - Updates ETA & alarm if       |
|  - journeys          |              |    |new_eta - old_eta| > 120s   |
|  - eta_updates       |              +----------------+----------------+
+----------------------+                               ^
                                                       |
                                              +--------+--------+
                                              |   Redis 7       |
                                              | Broker/Backend  |
                                              +-----------------+
```

---

## Prerequisites

- **Docker** & **Docker Compose** (recommended for full-stack local deployment)
- Or for manual setup:
  - **Python 3.11+**
  - **PostgreSQL 15+**
  - **Redis 7+**

---

## Quick Start with Docker Compose

1. **Navigate to the `backend` directory:**
   ```bash
   cd backend
   ```

2. **Create a `.env` file from the example template:**
   ```bash
   cp .env.example .env
   ```
   *(Optional)* Add your `OPENAI_API_KEY` in `.env` for LLM-powered trip parsing (if omitted, the built-in regex/heuristic parser is used automatically).

3. **Build and start all services (API, PostgreSQL, Redis, Celery Worker, Celery Beat):**
   ```bash
   docker compose up --build -d
   ```

4. **Verify the API is running:**
   - Health check: [http://localhost:8000/health](http://localhost:8000/health)
   - Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc documentation: [http://localhost:8000/redoc](http://localhost:8000/redoc)

5. **Run database migrations (optional — tables are also auto-initialized on startup):**
   ```bash
   docker compose exec api alembic revision --autogenerate -m "initial schema"
   docker compose exec api alembic upgrade head
   ```

---

## Manual Development Setup

1. **Create and activate a virtual environment:**
   ```bash
   cd backend
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # macOS / Linux:
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and update `DATABASE_URL` and `REDIS_URL` to point to your local PostgreSQL and Redis instances:
   ```env
   DATABASE_URL=postgresql+asyncpg://alarmy:alarmy_pass@localhost:5432/alarmy_db
   REDIS_URL=redis://localhost:6379/0
   ```

4. **Run Alembic migrations:**
   ```bash
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```

5. **Start the FastAPI development server:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Start Celery Worker and Celery Beat (in separate terminals):**
   ```bash
   celery -A app.workers.celery_app worker -l info
   celery -A app.workers.celery_app beat -l info
   ```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://alarmy:alarmy_pass@db:5432/alarmy_db` | Async SQLAlchemy PostgreSQL connection URL |
| `REDIS_URL` | `redis://redis:6379/0` | Redis URL used by Celery broker and result backend |
| `SECRET_KEY` | `change-me-in-production-...` | Secret key for signing JWT access tokens |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | JWT token validity duration in minutes |
| `OSRM_BASE_URL` | `http://router.project-osrm.org` | Base URL for OSRM routing engine |
| `OPENAI_API_KEY` | `""` | OpenAI API key for `/api/v1/ai/parse-journey` |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model used for structured extraction |
| `ETA_UPDATE_INTERVAL_SECONDS` | `300` | How often Celery Beat refreshes active journey ETAs (seconds) |
| `ALARM_BUFFER_MINUTES` | `30` | Default wake-up buffer before arrival (minutes) |
| `ETA_CHANGE_THRESHOLD_SECONDS` | `120` | Minimum ETA drift required to record an `EtaUpdate` and reschedule alarm |

---

## API Endpoints

All endpoints under `/api/v1` (except `/auth/register` and `/auth/login`) require a `Bearer <JWT>` header.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | Service health check |
| `POST` | `/api/v1/auth/register` | No | Register a new user and return JWT access token |
| `POST` | `/api/v1/auth/login` | No | Authenticate user credentials and return JWT access token |
| `GET` | `/api/v1/auth/me` | Yes | Get current authenticated user profile |
| `GET` | `/api/v1/destinations/search?q={query}&limit=10` | Yes | Geocode search query via OpenStreetMap Nominatim |
| `POST` | `/api/v1/destinations` | Yes | Save a selected destination to PostgreSQL |
| `GET` | `/api/v1/destinations/{destination_id}` | Yes | Retrieve a saved destination by UUID |
| `POST` | `/api/v1/journeys` | Yes | Create a new journey, compute initial ETA & alarm time |
| `GET` | `/api/v1/journeys` | Yes | List the authenticated user's journeys |
| `GET` | `/api/v1/journeys/{journey_id}` | Yes | Get details for a specific journey |
| `GET` | `/api/v1/journeys/{journey_id}/eta` | Yes | Fetch live ETA from OSRM and return updated alarm time |
| `PATCH` | `/api/v1/journeys/{journey_id}` | Yes | Update journey status, alarm buffer, coordinates, or ETA |
| `DELETE` | `/api/v1/journeys/{journey_id}` | Yes | Cancel a journey (`status = cancelled`) |
| `POST` | `/api/v1/ai/parse-journey` | Yes | Parse natural language trip text into destination + buffer |

---

## How the Alarm Logic Works

1. **Formula:**
   $$\text{alarm\_scheduled\_at} = \text{current\_eta} - \text{alarm\_buffer\_minutes}$$
2. When a user starts a journey from $(\text{origin\_lat}, \text{origin\_lon})$ to a destination $(\text{dest\_lat}, \text{dest\_lon})$ with a wake-up buffer (e.g., `30` minutes):
   - `ETAService` queries OSRM (`/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false`).
   - OSRM returns the estimated driving duration in seconds (`routes[0].duration`) and distance in meters (`routes[0].distance`).
   - $\text{current\_eta} = \text{now}_{\text{UTC}} + \text{duration\_seconds}$.
   - $\text{alarm\_scheduled\_at} = \text{current\_eta} - \text{ timedelta(minutes=alarm\_buffer\_minutes)}$.

---

## How Periodic ETA Updates Work

1. **Background Polling (`Celery Beat` + `Celery Worker`):**
   - Every `ETA_UPDATE_INTERVAL_SECONDS` (default `300` seconds / 5 minutes), Celery Beat triggers `refresh_eta_for_active_journeys`.
   - The worker queries all journeys where `status == 'active'`.
   - For each active journey, it calls `ETAService.get_eta()`.
2. **Threshold Evaluation:**
   - The worker compares the newly computed ETA (`new_eta`) with `journey.current_eta`.
   - If $|\text{new\_eta} - \text{current\_eta}| > \text{ETA\_CHANGE\_THRESHOLD\_SECONDS}$ (default `120` seconds / 2 minutes):
     1. A new `EtaUpdate` audit row is inserted recording `previous_eta`, `new_eta`, and `source="celery_poll"`.
     2. `journey.current_eta` is updated to `new_eta`.
     3. `journey.alarm_scheduled_at` is recomputed as `new_eta - alarm_buffer_minutes`.
3. **Client Synchronization:**
   - The mobile app either polls `GET /api/v1/journeys/{id}` or `GET /api/v1/journeys/{id}/eta` (optionally passing live `current_lat` & `current_lon` query params) and updates the local device alarm whenever `alarm_scheduled_at` shifts.
