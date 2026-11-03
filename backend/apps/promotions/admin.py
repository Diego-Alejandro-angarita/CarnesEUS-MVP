from django.contrib import admin

from .models import Promocion


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ["nombre", "porcentaje", "fecha_inicio", "fecha_fin", "activa", "estado"]
    list_editable = ["activa"]
    list_filter = ["activa"]
    search_fields = ["nombre"]
    filter_horizontal = ["productos"]
