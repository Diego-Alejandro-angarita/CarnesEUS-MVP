from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Producto
from apps.pedidos.models import ItemPedido

from .models import Resena
from .serializers import ResenaCrearSerializer, ResenaSerializer


def ha_comprado(usuario, producto: Producto) -> bool:
    """Si el usuario tiene al menos un pedido con ese producto (FR-18)."""
    return ItemPedido.objects.filter(pedido__usuario=usuario, producto=producto).exists()


@extend_schema_view(
    get=extend_schema(
        summary="Reseñas de un producto",
        description="Listado paginado, publico, de las reseñas de un producto.",
        responses={200: ResenaSerializer(many=True)},
    ),
    post=extend_schema(
        summary="Dejar una reseña",
        description=(
            "Crea la reseña del usuario autenticado para este producto. Exige "
            "haberlo comprado antes y no tener ya una reseña sobre el (para "
            "cambiarla hay que editarla, no duplicarla)."
        ),
        request=ResenaCrearSerializer,
        responses={201: ResenaSerializer},
    ),
)
class ResenaListCrearView(generics.ListCreateAPIView):
    # Fallback para la introspeccion de drf-spectacular, que llama a
    # get_queryset() sin kwargs de URL; en una peticion real siempre gana el
    # queryset de abajo.
    queryset = Resena.objects.none()

    def get_permissions(self):
        if self.request.method == "POST":
            return super().get_permissions()
        return [AllowAny()]

    def get_producto(self) -> Producto:
        return get_object_or_404(Producto, slug=self.kwargs["producto_slug"])

    def get_queryset(self):
        return Resena.objects.filter(producto=self.get_producto()).select_related("usuario")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ResenaCrearSerializer
        return ResenaSerializer

    def create(self, request, *args, **kwargs):
        producto = self.get_producto()

        if not ha_comprado(request.user, producto):
            return Response(
                {"detail": "Debes haber comprado este producto para poder reseñarlo."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if Resena.objects.filter(producto=producto, usuario=request.user).exists():
            return Response(
                {"detail": "Ya reseñaste este producto. Edita tu reseña para cambiarla."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        resena = entrada.save(producto=producto, usuario=request.user)

        return Response(
            ResenaSerializer(resena, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    patch=extend_schema(
        summary="Editar la reseña propia",
        request=ResenaCrearSerializer,
        responses={200: ResenaSerializer},
    ),
    delete=extend_schema(summary="Eliminar la reseña propia", responses={204: None}),
)
class ResenaDetalleView(generics.RetrieveUpdateDestroyAPIView):
    """Solo sobre la propia reseña: las de otros ni se ven por aqui (404)."""

    def get_queryset(self):
        return Resena.objects.filter(usuario=self.request.user)

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ResenaCrearSerializer
        return ResenaSerializer


@extend_schema(
    summary="Si el usuario puede reseñar este producto",
    description=(
        "Para que el frontend sepa que mostrar en la ficha: el formulario para "
        "dejar la reseña, la propia ya existente, o el aviso de que hace falta "
        "comprar el producto primero."
    ),
    responses={
        200: {
            "type": "object",
            "properties": {
                "ha_comprado": {"type": "boolean"},
                "ya_reseno": {"type": "boolean"},
                "puede_resenar": {"type": "boolean"},
            },
        }
    },
)
class PuedeResenarView(APIView):
    def get(self, request, producto_slug):
        producto = get_object_or_404(Producto, slug=producto_slug)
        comprado = ha_comprado(request.user, producto)
        ya_reseno = Resena.objects.filter(producto=producto, usuario=request.user).exists()

        return Response(
            {
                "ha_comprado": comprado,
                "ya_reseno": ya_reseno,
                "puede_resenar": comprado and not ya_reseno,
            }
        )
