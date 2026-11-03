from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "alarmy_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "refresh-eta-for-active-journeys": {
            "task": "app.workers.tasks.refresh_eta_for_active_journeys",
            "schedule": float(settings.ETA_UPDATE_INTERVAL_SECONDS),
        },
    },
)
