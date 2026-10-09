from django.contrib import admin

from .models import ZonaCobertura


@admin.register(ZonaCobertura)
class ZonaCoberturaAdmin(admin.ModelAdmin):
    list_display = ["barrio", "municipio", "activa", "actualizado_en"]
    list_editable = ["activa"]
    list_filter = ["activa", "municipio"]
    search_fields = ["barrio", "municipio"]