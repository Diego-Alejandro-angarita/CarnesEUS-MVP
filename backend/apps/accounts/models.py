from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from apps.common.models import TimeStampedModel


class UsuarioManager(BaseUserManager):
    """Manager que identifica al usuario por correo en vez de por username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("El correo es obligatorio.")
        email = self.normalize_email(email)
        usuario = self.model(email=email, **extra)
        # set_password se encarga del hash: la contrasena nunca se guarda plana.
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("rol", Usuario.Rol.CLIENTE)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("rol", Usuario.Rol.STAFF)
        if extra.get("is_staff") is not True:
            raise ValueError("Un superusuario debe tener is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Un superusuario debe tener is_superuser=True.")
        return self._create_user(email, password, **extra)


class Usuario(AbstractUser):
    """Cliente o personal de la carniceria. El login es por correo."""

    class Rol(models.TextChoices):
        CLIENTE = "CLIENTE", "Cliente"
        STAFF = "STAFF", "Personal de la carniceria"

    username = None
    email = models.EmailField("correo electronico", unique=True)
    nombre_completo = models.CharField("nombre completo", max_length=150)
    telefono = models.CharField("telefono", max_length=20, blank=True)
    rol = models.CharField("rol", max_length=10, choices=Rol.choices, default=Rol.CLIENTE)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre_completo"]

    objects = UsuarioManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.nombre_completo} <{self.email}>"

    @property
    def es_staff(self):
        """Permiso de negocio (panel de la carniceria), distinto de is_staff de Django."""
        return self.rol == self.Rol.STAFF or self.is_superuser


class Direccion(TimeStampedModel):
    """Direccion de entrega de un cliente."""

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name="direcciones",
        verbose_name="usuario",
    )
    etiqueta = models.CharField("etiqueta", max_length=50, default="Casa")
    ciudad = models.CharField("ciudad", max_length=80, default="Medellin")
    barrio = models.CharField("barrio", max_length=100, blank=True)
    direccion = models.CharField("direccion", max_length=200)
    notas = models.CharField("indicaciones", max_length=200, blank=True)
    es_principal = models.BooleanField("es la principal", default=False)
    # FR-15: indicador de zona de cobertura.
    en_zona_cobertura = models.BooleanField("dentro de la zona de cobertura", default=True)

    class Meta:
        verbose_name = "direccion"
        verbose_name_plural = "direcciones"
        ordering = ["-es_principal", "-creado_en"]

    def __str__(self):
        return f"{self.etiqueta}: {self.direccion}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.es_principal:
            # Solo una principal por usuario.
            Direccion.objects.filter(usuario=self.usuario).exclude(pk=self.pk).update(
                es_principal=False
            )
