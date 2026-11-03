from rest_framework import serializers

from .models import ZonaCobertura


class ZonaSerializer(serializers.ModelSerializer):
    """Un barrio cubierto, para sugerirlo mientras el cliente escribe."""

    class Meta:
        model = ZonaCobertura
        fields = ["municipio", "barrio"]
        read_only_fields = fields


class ConsultaCoberturaSerializer(serializers.Serializer):
    """Entrada de GET /api/cobertura/ (van en la query string)."""

    municipio = serializers.CharField(max_length=80)
    barrio = serializers.CharField(max_length=120)


class RespuestaCoberturaSerializer(serializers.Serializer):
    """Lo que el frontend pinta en el indicador."""

    cubierta = serializers.BooleanField()
    municipio = serializers.CharField()
    barrio = serializers.CharField()
    mensaje = serializers.CharField()