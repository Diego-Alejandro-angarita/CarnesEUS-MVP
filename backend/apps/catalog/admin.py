from django.contrib import admin

from .models import Categoria, Producto


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug"]
    search_fields = ["nombre"]
    prepopulated_fields = {"slug": ("nombre",)}


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "categoria", "presentacion", "precio", "disponible"]
    list_editable = ["precio", "disponible"]
    list_filter = ["disponible", "categoria"]
    search_fields = ["nombre", "descripcion"]
    prepopulated_fields = {"slug": ("nombre",)}
    autocomplete_fields = ["categoria"]
