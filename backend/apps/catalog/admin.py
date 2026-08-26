from django.contrib import admin

from .models import Categoria, Producto, Promocion


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug", "orden"]
    prepopulated_fields = {"slug": ("nombre",)}
    ordering = ["orden", "nombre"]


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "categoria", "precio", "unidad_medida", "stock", "disponible"]
    list_filter = ["categoria", "disponible", "unidad_medida"]
    list_editable = ["precio", "stock", "disponible"]
    search_fields = ["nombre", "descripcion"]
    prepopulated_fields = {"slug": ("nombre",)}


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ["nombre", "tipo", "valor", "inicia_en", "termina_en", "activa", "vigente"]
    list_filter = ["tipo", "activa"]
    filter_horizontal = ["productos"]

    @admin.display(boolean=True, description="vigente")
    def vigente(self, obj):
        return obj.vigente
