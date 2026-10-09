from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.views import PARAMETRO_TOKEN, CarritoMixin

from .models import ItemPedido, Pago, Pedido
from .serializers import CrearPedidoSerializer, PedidoSerializer


@extend_schema(
    summary="Comprar lo que hay en el carrito",
    description=(
        "Convierte el carrito en un pedido. Metodos de pago: transferencia "
        "(el pedido queda por confirmar y la respuesta trae los datos de la "
        "cuenta), contraentrega con QR o contraentrega con datafono (el pedido "
        "queda por cobrar). Los productos agotados no se cobran y se quedan "
        "en el carrito."
    ),
    parameters=[PARAMETRO_TOKEN],
    request=CrearPedidoSerializer,
    responses={201: PedidoSerializer},
)
class CrearPedidoView(CarritoMixin, APIView):
    def post(self, request):
        entrada = CrearPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        carrito = self.obtener_carrito(crear=False)
        items = (
            [item for item in carrito.items.select_related("producto") if item.comprable]
            if carrito
            else []
        )
        if not items:
            return Response(
                {"detail": "Tu carrito no tiene productos para comprar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total = sum(item.subtotal for item in items)
        metodo = datos["metodo_pago"]
        estado = (
            Pedido.Estado.POR_CONFIRMAR
            if metodo == Pago.Metodo.TRANSFERENCIA
            else Pedido.Estado.POR_COBRAR
        )

        with transaction.atomic():
            pedido = Pedido.objects.create(
                usuario=request.user if request.user.is_authenticated else None,
                nombre=datos["nombre"],
                email=datos["email"],
                telefono=datos["telefono"],
                direccion=datos["direccion"],
                municipio=datos["municipio"],
                barrio=datos["barrio"],
                notas=datos["notas"],
                estado=estado,
                total=total,
            )
            ItemPedido.objects.bulk_create(
                ItemPedido(
                    pedido=pedido,
                    producto=item.producto,
                    nombre=item.producto.nombre,
                    precio_unitario=item.producto.precio,
                    cantidad=item.cantidad,
                )
                for item in items
            )
            Pago.objects.create(pedido=pedido, metodo=metodo, monto=total)
            # Solo se vacian los productos comprados; un agotado sigue en el carrito.
            carrito.items.filter(pk__in=[item.pk for item in items]).delete()

        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)