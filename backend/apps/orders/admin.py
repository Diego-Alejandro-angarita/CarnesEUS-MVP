from django.contrib import admin

from .models import Carrito, ItemCarrito, ItemPedido, Pedido


class ItemCarritoInline(admin.TabularInline):
    model = ItemCarrito
    extra = 0


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    # Son un historico congelado: se consultan, no se editan.
    readonly_fields = [
        "producto",
        "nombre_producto",
        "precio_unitario",
        "unidad_medida",
        "cantidad",
        "subtotal",
    ]
    can_delete = False


@admin.register(Carrito)
class CarritoAdmin(admin.ModelAdmin):
    list_display = ["usuario", "activo", "creado_en"]
    list_filter = ["activo"]
    search_fields = ["usuario__email"]
    inlines = [ItemCarritoInline]


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["numero", "usuario", "estado", "total", "creado_en"]
    list_filter = ["estado", "creado_en"]
    search_fields = ["numero", "usuario__email", "direccion_texto"]
    readonly_fields = ["numero", "subtotal", "total", "direccion_texto", "creado_en"]
    inlines = [ItemPedidoInline]
    date_hierarchy = "creado_en"
