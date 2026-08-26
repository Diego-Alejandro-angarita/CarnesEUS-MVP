"""Configuracion de desarrollo local."""

from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "backend", "0.0.0.0"]

# El servidor de desarrollo de Angular corre en :4201 y hace proxy de /api
# hacia :8002. Se listan igual por si alguien prefiere apuntar directo.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:4201",
    "http://127.0.0.1:4201",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4201",
    "http://127.0.0.1:4201",
    "http://localhost:8002",
]

# Sin manifiesto de estaticos en dev: exige haber corrido collectstatic.
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
