# 🚆 Alarmy for Travelling — Destination-Based Travel Alarm

> **“Set your destination. We’ll wake you 30 minutes before you arrive.”**

Alarmy for Travelling is a full-stack mobile application designed for train and bus travellers who fall asleep during their journey and risk missing their stop. Unlike a standard clock alarm or countdown timer, the wake-up alarm is **always dynamically calculated from your real-time Expected Arrival Time (ETA)**:

$$\text{Alarm Time} = \text{Latest Expected Arrival Time (ETA)} - \text{Wake Buffer (default 30 min)}$$

If your train or bus gets delayed, the app detects the updated ETA, cancels the previous local alarm, and automatically reschedules a new device-local alarm for the updated arrival time minus your buffer.

---

## 🏗️ Project Structure

```text
alarmy-for-travelling/
├── backend/                  # FastAPI + Python 3.11 + PostgreSQL + Celery + Redis
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (auth, destinations, journeys, ai)
│   │   ├── core/             # Config, Async SQLAlchemy DB, JWT security
│   │   ├── models/           # User, Destination, Journey, EtaUpdate
│   │   ├── schemas/          # Pydantic v2 request/response schemas
│   │   ├── services/         # Abstracted ETAProvider (OSRM), Nominatim, OpenAI NLU
│   │   └── workers/          # Celery periodic ETA refresh worker & Beat schedule
│   ├── migrations/           # Alembic async migrations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── mobile/                   # React Native + Expo SDK 51 (TypeScript + Expo Router)
    ├── app/                  # Screens: Home, Active Journey, Alarm Firing, History, Auth
    ├── src/
    │   ├── components/       # DestinationSearch, EtaCard, EtaUpdateBanner, AiInput, etc.
    │   ├── hooks/            # useEtaPoller, useLocation, useNotificationHandler
    │   ├── services/         # Local alarm scheduler, GPS location, API client
    │   ├── store/            # Persisted Zustand stores (authStore, journeyStore)
    │   └── utils/            # Single-source computeAlarmTime() & date formatting
    ├── app.json
    └── package.json
```

---

## 🚀 Quick Start

### 1. Start the Backend (Docker Compose)

```bash
cd backend
cp .env.example .env
docker-compose up --build
```

The FastAPI server will be available at `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

### 2. Start the Mobile App (Expo)

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

See [backend/README.md](backend/README.md) and [mobile/README.md](mobile/README.md) for detailed configuration, API reference, and testing instructions.
