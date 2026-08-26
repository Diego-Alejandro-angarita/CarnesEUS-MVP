from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Direccion, Usuario


class DireccionInline(admin.TabularInline):
    model = Direccion
    extra = 0


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ["email", "nombre_completo", "rol", "is_active", "date_joined"]
    list_filter = ["rol", "is_active", "is_superuser"]
    search_fields = ["email", "nombre_completo", "telefono"]
    ordering = ["-date_joined"]
    inlines = [DireccionInline]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("nombre_completo", "telefono")}),
        ("Rol y permisos", {"fields": ("rol", "is_active", "is_staff", "is_superuser", "groups")}),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "nombre_completo", "rol", "password1", "password2"),
            },
        ),
    )


@admin.register(Direccion)
class DireccionAdmin(admin.ModelAdmin):
    list_display = ["usuario", "etiqueta", "ciudad", "direccion", "en_zona_cobertura"]
    list_filter = ["ciudad", "en_zona_cobertura"]
    search_fields = ["usuario__email", "direccion", "barrio"]
