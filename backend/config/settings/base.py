"""
Configuracion comun a todos los entornos.

Nada sensible se escribe aqui: las llaves y credenciales salen de variables de
entorno (archivo .env en desarrollo, variables reales en produccion).
"""

from decimal import Decimal
from pathlib import Path

import environ

# backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_SECRET_KEY=(str, "django-insecure-solo-desarrollo-cambiar-en-produccion"),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1", "[::1]"]),
    DATABASE_URL=(str, "postgres://carneseus:carneseus@localhost:5433/carneseus"),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
    FRONTEND_URL=(str, "http://localhost:4200"),
    COSTO_DOMICILIO=(str, "8000"),
    WOMPI_BASE_URL=(str, "https://sandbox.wompi.co/v1"),
    WOMPI_PUBLIC_KEY=(str, ""),
    WOMPI_PRIVATE_KEY=(str, ""),
    WOMPI_EVENTS_SECRET=(str, ""),
    WOMPI_INTEGRITY_SECRET=(str, ""),
)

environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --------------------------------------------------------------------------
# Aplicaciones
# --------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
]

# Monolito modular: un despliegue, pero con fronteras claras entre modulos.
LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.catalog",
    "apps.orders",
    "apps.payments",
    "apps.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --------------------------------------------------------------------------
# Base de datos
# --------------------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------------
# Autenticacion
# --------------------------------------------------------------------------
# Definido ANTES de la primera migracion: cambiarlo despues es doloroso.
AUTH_USER_MODEL = "accounts.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Requisito no funcional de la wiki: sesiones con expiracion.
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 dias
SESSION_SAVE_EVERY_REQUEST = True

# Angular NO debe poder leer la cookie de sesion...
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
# ...pero SI debe poder leer la de CSRF para reenviarla en el header.
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# --------------------------------------------------------------------------
# CORS
# --------------------------------------------------------------------------
# En desarrollo Angular hace proxy de /api hacia :8000, asi que todo es del
# mismo origen y CORS no interviene. Esto solo hace falta si algun dia el
# frontend vive en otro dominio.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# --------------------------------------------------------------------------
# Internacionalizacion
# --------------------------------------------------------------------------
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

# --------------------------------------------------------------------------
# Archivos estaticos y multimedia
# --------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --------------------------------------------------------------------------
# Django REST Framework
# --------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.PaginacionEstandar",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CarnesEUS API",
    "DESCRIPTION": "API del e-commerce de carniceria CarnesEUS.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# --------------------------------------------------------------------------
# Reglas de negocio
# --------------------------------------------------------------------------
FRONTEND_URL = env("FRONTEND_URL")
COSTO_DOMICILIO = Decimal(env("COSTO_DOMICILIO"))

# FR-15: la cobertura la decide el backend, no el cliente. Si llegara del
# formulario, cualquiera podria pedir domicilio fuera del area de reparto.
ZONAS_COBERTURA = env.list(
    "ZONAS_COBERTURA",
    default=["Medellin", "Envigado", "Itagui", "Sabaneta", "Bello", "La Estrella"],
)

# --------------------------------------------------------------------------
# Wompi (pasarela de pagos)
# --------------------------------------------------------------------------
WOMPI_BASE_URL = env("WOMPI_BASE_URL").rstrip("/")
WOMPI_PUBLIC_KEY = env("WOMPI_PUBLIC_KEY")
WOMPI_PRIVATE_KEY = env("WOMPI_PRIVATE_KEY")
WOMPI_EVENTS_SECRET = env("WOMPI_EVENTS_SECRET")
WOMPI_INTEGRITY_SECRET = env("WOMPI_INTEGRITY_SECRET")
WOMPI_MONEDA = "COP"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        # Los pagos siempre se registran: sin esto, depurar un webhook es adivinar.
        "apps.payments": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
