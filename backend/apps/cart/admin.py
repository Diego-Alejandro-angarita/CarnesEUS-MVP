from django.contrib import admin

from .models import Carrito, ItemCarrito


class ItemCarritoInline(admin.TabularInline):
    model = ItemCarrito
    extra = 0
    autocomplete_fields = ["producto"]


@admin.register(Carrito)
class CarritoAdmin(admin.ModelAdmin):
    list_display = ["__str__", "usuario", "cantidad_items", "total", "actualizado_en"]
    search_fields = ["token", "usuario__email"]
    inlines = [ItemCarritoInline]