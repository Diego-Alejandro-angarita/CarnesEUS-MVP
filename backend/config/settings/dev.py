"""Configuracion de desarrollo local."""

from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "backend", "0.0.0.0"]

# El servidor de desarrollo de Angular corre en :4200 y hace proxy de /api
# hacia :8001. Se listan igual por si alguien prefiere apuntar directo.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:8001",
]

# Sin manifiesto de estaticos en dev: exige haber corrido collectstatic.
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
