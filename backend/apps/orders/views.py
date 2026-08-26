from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import EsStaff

from .models import ItemCarrito, Pedido
from .serializers import (
    CambiarEstadoSerializer,
    CarritoSerializer,
    CrearPedidoSerializer,
    ItemCarritoSerializer,
    PedidoSerializer,
)
from .services import crear_pedido_desde_carrito, obtener_carrito_activo


class CarritoView(APIView):
    """FR-10: el carrito del usuario autenticado."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CarritoSerializer})
    def get(self, request):
        carrito = obtener_carrito_activo(request.user)
        return Response(CarritoSerializer(carrito, context={"request": request}).data)

    @extend_schema(request=None, responses={204: None}, description="Vacia el carrito.")
    def delete(self, request):
        carrito = obtener_carrito_activo(request.user)
        carrito.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemCarritoViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ItemCarrito.objects.none()
    serializer_class = ItemCarritoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return ItemCarrito.objects.filter(
            carrito__usuario=self.request.user, carrito__activo=True
        ).select_related("producto")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        carrito = obtener_carrito_activo(request.user)
        producto = serializer.validated_data["producto"]
        cantidad = serializer.validated_data["cantidad"]

        # Agregar dos veces el mismo corte suma, no falla por la restriccion
        # unique_together.
        item = carrito.items.filter(producto=producto).first()
        if item:
            item.cantidad += cantidad
            revalidar = self.get_serializer(
                item, data={"producto": producto.pk, "cantidad": item.cantidad}, partial=True
            )
            revalidar.is_valid(raise_exception=True)
            item.save(update_fields=["cantidad", "actualizado_en"])
        else:
            item = serializer.save(carrito=carrito)

        return Response(
            self.get_serializer(item).data,
            status=status.HTTP_201_CREATED,
        )


class PedidoViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """FR-12: pedidos del cliente y gestion de estados por el personal."""

    queryset = Pedido.objects.none()
    serializer_class = PedidoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["estado"]
    ordering_fields = ["creado_en", "total"]

    def get_queryset(self):
        usuario = self.request.user
        if not usuario.is_authenticated:
            return Pedido.objects.none()

        queryset = Pedido.objects.prefetch_related("items", "pagos").select_related("usuario")
        if not usuario.es_staff:
            # El cliente solo ve los suyos.
            queryset = queryset.filter(usuario=usuario)
        return queryset

    @extend_schema(request=CrearPedidoSerializer, responses={201: PedidoSerializer})
    def create(self, request):
        serializer = CrearPedidoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        pedido = crear_pedido_desde_carrito(
            usuario=request.user,
            direccion=serializer.validated_data["direccion"],
            notas=serializer.validated_data.get("notas", ""),
        )
        return Response(
            PedidoSerializer(pedido, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=CambiarEstadoSerializer, responses={200: PedidoSerializer})
    @action(detail=True, methods=["patch"], permission_classes=[EsStaff])
    def estado(self, request, pk=None):
        pedido = self.get_object()
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nuevo = serializer.validated_data["estado"]
        if not pedido.esta_pagado and nuevo != Pedido.Estado.CANCELADO:
            return Response(
                {"estado": "No se puede preparar ni despachar un pedido sin pagar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedido.estado = nuevo
        pedido.save(update_fields=["estado", "actualizado_en"])
        return Response(PedidoSerializer(pedido, context={"request": request}).data)
