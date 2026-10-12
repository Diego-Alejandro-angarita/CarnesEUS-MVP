from rest_framework import serializers

from .models import Resena


class ResenaSerializer(serializers.ModelSerializer):
    """Reseña para mostrar en la ficha del producto."""

    usuario_nombre = serializers.SerializerMethodField()
    es_propia = serializers.SerializerMethodField()

    class Meta:
        model = Resena
        fields = [
            "id",
            "usuario_nombre",
            "calificacion",
            "comentario",
            "es_propia",
            "creado_en",
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, resena: Resena) -> str:
        nombre = f"{resena.usuario.first_name} {resena.usuario.last_name}".strip()
        return nombre or resena.usuario.email

    def get_es_propia(self, resena: Resena) -> bool:
        usuario = self.context["request"].user
        return usuario.is_authenticated and resena.usuario_id == usuario.id


class ResenaCrearSerializer(serializers.ModelSerializer):
    """Entrada para dejar o editar la reseña propia de un producto."""

    class Meta:
        model = Resena
        fields = ["calificacion", "comentario"]
