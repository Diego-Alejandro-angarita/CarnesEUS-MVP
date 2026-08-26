import unicodedata

from django.conf import settings


def _normalizar(texto):
    """Quita tildes y unifica mayusculas: 'Itagüí' y 'itagui' deben coincidir."""
    sin_tildes = unicodedata.normalize("NFKD", texto or "")
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    return sin_tildes.strip().casefold()


def esta_en_zona_cobertura(ciudad):
    """FR-15: indica si la ciudad esta dentro del area de reparto."""
    ciudad_normalizada = _normalizar(ciudad)
    return any(_normalizar(z) == ciudad_normalizada for z in settings.ZONAS_COBERTURA)
