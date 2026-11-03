from django.contrib import admin

from .models import Resena


@admin.register(Resena)
class ResenaAdmin(admin.ModelAdmin):
    list_display = ["producto", "usuario", "calificacion", "creado_en"]
    list_filter = ["calificacion"]
    search_fields = ["producto__nombre", "usuario__email", "comentario"]
    autocomplete_fields = ["producto", "usuario"]
