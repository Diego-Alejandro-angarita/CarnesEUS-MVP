from django.db import models


class TimeStampedModel(models.Model):
    """Base de todos los modelos del dominio: saber cuando se creo y se toco algo."""

    creado_en = models.DateTimeField("creado en", auto_now_add=True)
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)

    class Meta:
        abstract = True
