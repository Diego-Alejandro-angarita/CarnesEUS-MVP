from django.contrib import admin

from .models import CambioEtapa, ItemPedido, Pago, Pedido


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    can_delete = False
    readonly_fields = ["producto", "nombre", "precio_unitario", "cantidad"]


class PagoInline(admin.StackedInline):
    model = Pago
    extra = 0
    can_delete = False
    readonly_fields = ["metodo", "monto"]


class CambioEtapaInline(admin.TabularInline):
    """Seguimiento del pedido (FR-12), solo para consultar."""

    model = CambioEtapa
    extra = 0
    can_delete = False
    readonly_fields = ["etapa", "creado_en"]
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.action(description="Marcar los pedidos seleccionados como pagados")
def marcar_como_pagados(modeladmin, request, queryset):
    for pedido in queryset:
        pedido.marcar_pagado()


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = [
        "id", "nombre", "municipio", "barrio", "estado", "etapa", "total", "creado_en"
    ]
    list_filter = ["estado", "etapa", "municipio"]
    search_fields = ["nombre", "email", "telefono"]
    # La etapa se cambia desde el panel, que aplica las reglas de FR-12.
    readonly_fields = ["etapa"]
    actions = [marcar_como_pagados]
    inlines = [PagoInline, ItemPedidoInline, CambioEtapaInline]