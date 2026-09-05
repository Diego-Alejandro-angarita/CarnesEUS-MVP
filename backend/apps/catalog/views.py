from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView
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
