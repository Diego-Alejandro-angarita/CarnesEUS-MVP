from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.views import PARAMETRO_TOKEN, CarritoMixin

from .models import ItemPedido, Pago, Pedido
from .serializers import (
    CambiarEstadoSerializer,
    CambiarEtapaSerializer,
    ConsultarPedidoSerializer,
    CrearPedidoSerializer,
    PedidoClienteListaSerializer,
    PedidoListaSerializer,
    PedidoSerializer,
)

# Lo que pide PedidoSerializer, para no consultar item por item.
PEDIDOS_CON_DETALLE = Pedido.objects.select_related("pago").prefetch_related("items", "historial")


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


@extend_schema(
    summary="Listado de pedidos",
    description=(
        "Panel administrativo (FR-19): listado paginado de pedidos, mas reciente "
        "primero. Acepta el parametro estado (por_confirmar, por_cobrar, pagado) "
        "y el parametro etapa (recibido, en_preparacion, en_camino, entregado, "
        "cancelado)."
    ),
    responses={200: PedidoListaSerializer(many=True)},
)
class PedidoListView(ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PedidoListaSerializer
    queryset = Pedido.objects.select_related("pago")
    filterset_fields = ["estado", "etapa"]


@extend_schema(
    summary="Detalle de un pedido",
    description="Panel administrativo (FR-19): un pedido con sus items y su pago.",
    responses={200: PedidoSerializer},
)
class PedidoDetalleView(RetrieveAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PedidoSerializer
    queryset = PEDIDOS_CON_DETALLE


@extend_schema(
    summary="Cambiar el estado de un pedido",
    description=(
        "Panel administrativo (FR-19): mueve el pedido a por_confirmar, "
        "por_cobrar o pagado. El pago se sincroniza solo: aprobado cuando el "
        "pedido queda pagado, pendiente en cualquier otro estado."
    ),
    request=CambiarEstadoSerializer,
    responses={200: PedidoSerializer},
)
class CambiarEstadoPedidoView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        entrada = CambiarEstadoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        pedido = get_object_or_404(Pedido, pk=pk)
        pedido.cambiar_estado(entrada.validated_data["estado"])
        return Response(PedidoSerializer(pedido).data)

@extend_schema(
    summary="Cambiar la etapa de un pedido",
    description=(
        "Estados del pedido (FR-12): avanza el pedido un paso (recibido, en "
        "preparacion, en camino, entregado) o lo cancela mientras no haya salido "
        "a entrega. Cualquier otro cambio responde 400. No toca el pago."
    ),
    request=CambiarEtapaSerializer,
    responses={200: PedidoSerializer},
)
class CambiarEtapaPedidoView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        entrada = CambiarEtapaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        pedido = get_object_or_404(Pedido, pk=pk)
        try:
            pedido.cambiar_etapa(entrada.validated_data["etapa"])
        except ValidationError as error:
            return Response({"detail": error.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PedidoSerializer(PEDIDOS_CON_DETALLE.get(pk=pk)).data)


@extend_schema(
    summary="Mis pedidos",
    description=(
        "Estados del pedido (FR-12): los pedidos del cliente con sesion, mas "
        "reciente primero."
    ),
    responses={200: PedidoClienteListaSerializer(many=True)},
)
class MisPedidosView(ListAPIView):
    serializer_class = PedidoClienteListaSerializer

    def get_queryset(self):
        # drf-spectacular arma el esquema con un usuario anonimo.
        if getattr(self, "swagger_fake_view", False):
            return Pedido.objects.none()
        return Pedido.objects.select_related("pago").filter(usuario=self.request.user)


@extend_schema(
    summary="Detalle de uno de mis pedidos",
    description=(
        "Estados del pedido (FR-12): un pedido del cliente con sesion, con su "
        "seguimiento. Un pedido de otra persona responde 404."
    ),
    responses={200: PedidoSerializer},
)
class MiPedidoDetalleView(RetrieveAPIView):
    serializer_class = PedidoSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Pedido.objects.none()
        return PEDIDOS_CON_DETALLE.filter(usuario=self.request.user)


@extend_schema(
    summary="Consultar un pedido con numero y correo",
    description=(
        "Estados del pedido (FR-12): para quien compro sin cuenta. Devuelve el "
        "pedido si el numero y el correo coinciden (sin distinguir mayusculas); "
        "si no, 404. Va por POST para que el correo no quede en la URL."
    ),
    request=ConsultarPedidoSerializer,
    responses={200: PedidoSerializer},
)
class ConsultarPedidoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        entrada = ConsultarPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        # Mismo 404 si el numero no existe o el correo no coincide: asi no se
        # puede averiguar que numeros de pedido existen.
        pedido = PEDIDOS_CON_DETALLE.filter(
            pk=datos["numero"], email__iexact=datos["email"]
        ).first()
        if pedido is None:
            return Response(
                {"detail": "No encontramos un pedido con ese numero y ese correo."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PedidoSerializer(pedido).data)
