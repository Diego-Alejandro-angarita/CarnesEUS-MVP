from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from .models import Direccion, Usuario
from .services import esta_en_zona_cobertura


class UsuarioSerializer(serializers.ModelSerializer):
    es_staff = serializers.BooleanField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre_completo", "telefono", "rol", "es_staff"]
        read_only_fields = ["id", "rol", "es_staff"]


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password2 = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = ["email", "nombre_completo", "telefono", "password", "password2"]

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Las contrasenas no coinciden."})
        password_validation.validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        # Siempre CLIENTE: el rol STAFF solo se asigna desde el admin de Django.
        return Usuario.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        usuario = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].lower(),
            password=attrs["password"],
        )
        if usuario is None:
            # Mensaje generico a proposito: no revela si el correo existe.
            raise serializers.ValidationError("Correo o contrasena incorrectos.")
        if not usuario.is_active:
            raise serializers.ValidationError("Esta cuenta esta desactivada.")
        attrs["usuario"] = usuario
        return attrs


class DireccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direccion
        fields = [
            "id",
            "etiqueta",
            "ciudad",
            "barrio",
            "direccion",
            "notas",
            "es_principal",
            "en_zona_cobertura",
        ]
        # La cobertura la calcula el backend a partir de la ciudad (FR-15).
        read_only_fields = ["id", "en_zona_cobertura"]

    def create(self, validated_data):
        validated_data["en_zona_cobertura"] = esta_en_zona_cobertura(validated_data["ciudad"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "ciudad" in validated_data:
            validated_data["en_zona_cobertura"] = esta_en_zona_cobertura(validated_data["ciudad"])
        return super().update(instance, validated_data)
