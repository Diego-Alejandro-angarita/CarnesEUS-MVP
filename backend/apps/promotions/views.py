from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAdminUser

from apps.catalog.models import Producto

from .models import Promocion
from .serializers import ProductoOpcionSerializer, PromocionSerializer


@extend_schema_view(
    get=extend_schema(
        summary="Listado de promociones",
        description="Todas las promociones, vigentes o no, con su estado de hoy. Solo staff.",
        responses={200: PromocionSerializer(many=True)},
    ),
    post=extend_schema(
        summary="Crear una promocion",
        description=(
            "Da de alta un descuento porcentual sobre los productos elegidos, valido "
            "entre fecha_inicio y fecha_fin (ambas incluidas). Solo staff."
        ),
        request=PromocionSerializer,
        responses={201: PromocionSerializer},
    ),
)
class PromocionListView(ListCreateAPIView):
    serializer_class = PromocionSerializer
    permission_classes = [IsAdminUser]
    queryset = Promocion.objects.prefetch_related("productos")


@extend_schema_view(
    get=extend_schema(summary="Datos de una promocion", responses={200: PromocionSerializer}),
    put=extend_schema(
        summary="Reemplazar una promocion",
        request=PromocionSerializer,
        responses={200: PromocionSerializer},
    ),
    patch=extend_schema(
        summary="Modificar una promocion",
        description="Actualiza los campos enviados. Solo staff.",
        request=PromocionSerializer,
        responses={200: PromocionSerializer},
    ),
    delete=extend_schema(
        summary="Eliminar una promocion",
        description="Borra la promocion; los productos vuelven a su precio de lista.",
        responses={204: None},
    ),
)
class PromocionDetalleView(RetrieveUpdateDestroyAPIView):
    serializer_class = PromocionSerializer
    permission_classes = [IsAdminUser]
    queryset = Promocion.objects.prefetch_related("productos")


@extend_schema(
    summary="Productos para armar una promocion",
    description=(
        "Todos los productos del catalogo, sin paginar, para el selector del formulario "
        "de promociones. Solo staff."
    ),
    responses={200: ProductoOpcionSerializer(many=True)},
)
class ProductoOpcionListView(ListAPIView):
    serializer_class = ProductoOpcionSerializer
    permission_classes = [IsAdminUser]
    # Sin paginar: el selector necesita verlos todos y el catalogo publico corta
    # en 100 por pagina.
    pagination_class = None
    filter_backends = []
    queryset = Producto.objects.visibles().select_related("categoria").order_by("nombre")
