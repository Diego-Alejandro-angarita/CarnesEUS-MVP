from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Producto

from .models import Carrito, ItemPedido, Pedido

CERO = Decimal("0")


def obtener_carrito_activo(usuario):
    carrito, _ = Carrito.objects.get_or_create(usuario=usuario, activo=True)
    return carrito


@transaction.atomic
def crear_pedido_desde_carrito(usuario, direccion, notas=""):
    """
    Convierte el carrito activo en un pedido con los precios congelados.

    Todo ocurre en una transaccion: o queda el pedido completo con sus lineas,
    o no queda nada.
    """
    carrito = (
        Carrito.objects.filter(usuario=usuario, activo=True)
        .prefetch_related("items__producto")
        .first()
    )
    items = list(carrito.items.all()) if carrito else []
    if not items:
        raise ValidationError({"carrito": "El carrito esta vacio."})

    if direccion.usuario_id != usuario.id:
        raise ValidationError({"direccion": "La direccion no pertenece a este usuario."})
    if not direccion.en_zona_cobertura:
        raise ValidationError(
            {"direccion": "Esta direccion esta fuera de nuestra zona de cobertura."}
        )

    # Se bloquean los productos para que dos pedidos simultaneos no lean el
    # mismo stock y ambos lo den por bueno.
    ids = [item.producto_id for item in items]
    productos = Producto.objects.select_for_update().in_bulk(ids)

    for item in items:
        producto = productos[item.producto_id]
        if not producto.disponible:
            raise ValidationError(
                {"carrito": f"'{producto.nombre}' ya no esta disponible."}
            )
        if producto.stock < item.cantidad:
            raise ValidationError(
                {
                    "carrito": (
                        f"Solo quedan {producto.stock} de '{producto.nombre}' "
                        f"y pediste {item.cantidad}."
                    )
                }
            )

    pedido = Pedido.objects.create(
        usuario=usuario,
        direccion=direccion,
        direccion_texto=f"{direccion.direccion}, {direccion.barrio}, {direccion.ciudad}".replace(
            ", ,", ","
        ),
        costo_domicilio=settings.COSTO_DOMICILIO,
        notas=notas,
    )

    ItemPedido.objects.bulk_create(
        [
            ItemPedido(
                pedido=pedido,
                producto=productos[item.producto_id],
                nombre_producto=productos[item.producto_id].nombre,
                precio_unitario=productos[item.producto_id].precio,
                unidad_medida=productos[item.producto_id].unidad_medida,
                cantidad=item.cantidad,
                subtotal=(productos[item.producto_id].precio * item.cantidad).quantize(
                    Decimal("0.01")
                ),
            )
            for item in items
        ]
    )

    pedido.recalcular_totales()
    pedido.save(update_fields=["subtotal", "total", "actualizado_en"])

    # El carrito se cierra: si el pago falla, el pedido queda ahi para
    # reintentar en vez de obligar a armar la compra de nuevo.
    carrito.activo = False
    carrito.save(update_fields=["activo", "actualizado_en"])

    return pedido
