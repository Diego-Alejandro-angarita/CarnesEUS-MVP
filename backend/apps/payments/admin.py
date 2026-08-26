from django.contrib import admin

from .models import Pago, WompiEvent


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ["referencia", "pedido", "estado", "monto", "metodo_pago", "creado_en"]
    list_filter = ["estado", "metodo_pago"]
    search_fields = ["referencia", "wompi_transaction_id", "pedido__numero"]
    # Los pagos son un registro de lo que dijo Wompi: se consultan, no se editan.
    readonly_fields = [f.name for f in Pago._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(WompiEvent)
class WompiEventAdmin(admin.ModelAdmin):
    list_display = ["evento", "transaccion_id", "creado_en"]
    search_fields = ["transaccion_id", "checksum"]
    readonly_fields = [f.name for f in WompiEvent._meta.fields]

    def has_add_permission(self, request):
        return False
