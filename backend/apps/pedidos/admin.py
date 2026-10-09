from django.contrib import admin

from .models import ItemPedido, Pago, Pedido


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


@admin.action(description="Marcar los pedidos seleccionados como pagados")
def marcar_como_pagados(modeladmin, request, queryset):
    for pedido in queryset:
        pedido.estado = Pedido.Estado.PAGADO
        pedido.save(update_fields=["estado"])
        Pago.objects.filter(pedido=pedido).update(estado=Pago.Estado.APROBADO)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["id", "nombre", "municipio", "barrio", "estado", "total", "creado_en"]
    list_filter = ["estado", "municipio"]
    search_fields = ["nombre", "email", "telefono"]
    actions = [marcar_como_pagados]
    inlines = [PagoInline, ItemPedidoInline]