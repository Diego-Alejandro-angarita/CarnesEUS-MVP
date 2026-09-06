from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from .models import Producto
from .serializers import ProductoSerializer


@extend_schema(
    summary="Listado paginado del catalogo",
    description=(
        "Devuelve los productos del catalogo con foto, precio y disponibilidad. "
        "Acepta los parametros page y page_size."
    ),
    responses={200: ProductoSerializer(many=True)},
)
class ProductoListView(ListAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [AllowAny]
    queryset = Producto.objects.select_related("categoria")


@extend_schema(
    summary="Ficha de un producto",
    description="Devuelve el detalle completo de un producto a partir de su slug.",
    responses={200: ProductoSerializer},
)
class ProductoDetalleView(RetrieveAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [AllowAny]
    queryset = Producto.objects.select_related("categoria")
    lookup_field = "slug"
