import unicodedata

from django.db import models

from apps.common.models import TimeStampedModel


def normalizar(texto: str) -> str:
    """Sin tildes, en minusculas y sin espacios sobrantes."""
    sin_tildes = "".join(
        letra
        for letra in unicodedata.normalize("NFKD", texto)
        if not unicodedata.combining(letra)
    )
    return " ".join(sin_tildes.casefold().split())


class ZonaCobertura(TimeStampedModel):
    """Un barrio al que la carniceria hace domicilios (FR-15)."""

    municipio = models.CharField("municipio", max_length=80)
    barrio = models.CharField("barrio", max_length=120)
    activa = models.BooleanField(
        "activa",
        default=True,
        help_text="Desmarcala para dejar de cubrir el barrio sin borrarlo.",
    )
    clave = models.CharField("clave", max_length=210, unique=True, editable=False)

    class Meta:
        verbose_name = "zona de cobertura"
        verbose_name_plural = "zonas de cobertura"
        ordering = ["municipio", "barrio"]

    def __str__(self):
        return f"{self.barrio} ({self.municipio})"

    @staticmethod
    def construir_clave(municipio: str, barrio: str) -> str:
        return f"{normalizar(municipio)}|{normalizar(barrio)}"

    def save(self, *args, **kwargs):
        self.clave = self.construir_clave(self.municipio, self.barrio)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = {*update_fields, "clave"}
        super().save(*args, **kwargs)

    @classmethod
    def cubre(cls, municipio: str, barrio: str) -> bool:
        clave = cls.construir_clave(municipio, barrio)
        return cls.objects.filter(clave=clave, activa=True).exists()