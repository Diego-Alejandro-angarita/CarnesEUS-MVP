from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UsuarioManager(BaseUserManager):
    """Los usuarios de CarnesEUS inician sesion con correo, no con username."""

    use_in_migrations = True

    def _crear_usuario(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("El correo es obligatorio")
        email = self.normalize_email(email)
        usuario = self.model(email=email, **extra_fields)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._crear_usuario(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._crear_usuario(email, password, **extra_fields)


class Usuario(AbstractUser):
    """Cliente de CarnesEUS. Reemplaza el username de Django por el correo."""

    username = None
    email = models.EmailField("correo electronico", unique=True)
    telefono = models.CharField("telefono", max_length=20, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UsuarioManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self) -> str:
        return self.email
