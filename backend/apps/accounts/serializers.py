from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Datos publicos de un usuario ya autenticado."""

    class Meta:
        model = Usuario
        fields = ["id", "first_name", "last_name", "email", "telefono"]
        read_only_fields = fields


class RegistroSerializer(serializers.ModelSerializer):
    """Alta de un cliente nuevo con confirmacion de contrasena."""

    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirmacion = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "telefono",
            "password",
            "password_confirmacion",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate_email(self, valor: str) -> str:
        valor = valor.lower()
        if Usuario.objects.filter(email=valor).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return valor

    def validate(self, atributos: dict) -> dict:
        if atributos["password"] != atributos["password_confirmacion"]:
            raise serializers.ValidationError(
                {"password_confirmacion": "Las contrasenas no coinciden."}
            )

        usuario_temporal = Usuario(
            email=atributos.get("email", ""),
            first_name=atributos.get("first_name", ""),
            last_name=atributos.get("last_name", ""),
        )
        try:
            password_validation.validate_password(atributos["password"], usuario_temporal)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)}) from error

        return atributos

    def create(self, datos_validados: dict) -> Usuario:
        datos_validados.pop("password_confirmacion")
        password = datos_validados.pop("password")
        return Usuario.objects.create_user(password=password, **datos_validados)


class LoginSerializer(serializers.Serializer):
    """Valida credenciales de un cliente ya registrado."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, atributos: dict) -> dict:
        usuario = authenticate(
            self.context["request"],
            username=atributos["email"].lower(),
            password=atributos["password"],
        )
        if usuario is None:
            raise serializers.ValidationError("Correo o contrasena incorrectos.")

        atributos["usuario"] = usuario
        return atributos
