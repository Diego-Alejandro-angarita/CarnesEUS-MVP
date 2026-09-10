from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Carrito, ItemCarrito
from .serializers import (
    ActualizarItemSerializer,
    AgregarItemSerializer,
    CarritoSerializer,
)

CABECERA_TOKEN = "X-Carrito-Token"

PARAMETRO_TOKEN = OpenApiParameter(
    name=CABECERA_TOKEN,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "Token del carrito de un visitante sin cuenta. Se obtiene del primer "
        "GET /api/carrito/ y el navegador lo reenvia en cada peticion."
    ),
)


class CarritoMixin:
    """Resuelve de que carrito estamos hablando."""

    permission_classes = [AllowAny]

    def obtener_carrito(self, crear: bool = True) -> Carrito | None:
        peticion = self.request

        # Con sesion iniciada manda el usuario: el token del navegador puede ser
        # de otro visitante que uso el mismo equipo.
        if peticion.user.is_authenticated:
            carrito, _ = Carrito.objects.get_or_create(usuario=peticion.user)
            return carrito

        token = peticion.headers.get(CABECERA_TOKEN)
        if token:
            carrito = Carrito.objects.filter(token=token, usuario__isnull=True).first()
            if carrito:
                return carrito

        return Carrito.objects.create() if crear else None


@extend_schema(
    summary="Ver el carrito",
    description=(
        "Devuelve el carrito con sus lineas y el total. Si el visitante no tiene "
        "carrito todavia se le crea uno y se le entrega el token."
    ),
    parameters=[PARAMETRO_TOKEN],
    responses={200: CarritoSerializer},
)
class CarritoView(CarritoMixin, APIView):
    def get(self, request):
        carrito = self.obtener_carrito()
        return Response(CarritoSerializer(carrito).data)


@extend_schema(
    summary="Agregar un producto al carrito",
    description=(
        "Agrega el producto. Si ya estaba en el carrito suma la cantidad en vez "
        "de repetir la linea."
    ),
    parameters=[PARAMETRO_TOKEN],
    request=AgregarItemSerializer,
    responses={201: CarritoSerializer},
)
class AgregarItemView(CarritoMixin, APIView):
    def post(self, request):
        entrada = AgregarItemSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        carrito = self.obtener_carrito()
        producto = entrada.validated_data["producto"]
        cantidad = entrada.validated_data["cantidad"]

        item, creado = ItemCarrito.objects.get_or_create(
            carrito=carrito,
            producto=producto,
            defaults={"cantidad": cantidad},
        )
        if not creado:
            item.cantidad += cantidad
            item.save(update_fields=["cantidad", "actualizado_en"])

        return Response(CarritoSerializer(carrito).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    patch=extend_schema(
        summary="Cambiar la cantidad de una linea",
        parameters=[PARAMETRO_TOKEN],
        request=ActualizarItemSerializer,
        responses={200: CarritoSerializer},
    ),
    delete=extend_schema(
        summary="Quitar un producto del carrito",
        parameters=[PARAMETRO_TOKEN],
        responses={200: CarritoSerializer},
    ),
)
class ItemDetalleView(CarritoMixin, APIView):
    def obtener_item(self, pk: int) -> ItemCarrito:
        # Se busca dentro del carrito de quien pregunta: nadie puede tocar el
        # carrito ajeno mandando un id cualquiera.
        carrito = self.obtener_carrito(crear=False)
        if carrito is None:
            from django.http import Http404

            raise Http404
        return get_object_or_404(ItemCarrito, pk=pk, carrito=carrito)

    def patch(self, request, pk: int):
        item = self.obtener_item(pk)
        entrada = ActualizarItemSerializer(item, data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(CarritoSerializer(item.carrito).data)

    def delete(self, request, pk: int):
        item = self.obtener_item(pk)
        carrito = item.carrito
        item.delete()
        return Response(CarritoSerializer(carrito).data)