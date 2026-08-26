from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import SoloLecturaOStaff

from .filters import ProductoFilter
from .models import Categoria, Producto
from .serializers import CategoriaSerializer, DisponibilidadSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [SoloLecturaOStaff]
    lookup_field = "slug"
    pagination_class = None


class ProductoViewSet(viewsets.ModelViewSet):
    """FR-00/03/04/05/07/08/09/16: catalogo publico, CRUD solo para el staff."""

    queryset = Producto.objects.select_related("categoria")
    serializer_class = ProductoSerializer
    permission_classes = [SoloLecturaOStaff]
    lookup_field = "slug"
    filterset_class = ProductoFilter
    search_fields = ["nombre", "descripcion"]
    ordering_fields = ["nombre", "precio", "creado_en"]

    def get_queryset(self):
        queryset = super().get_queryset()
        usuario = self.request.user
        es_staff = usuario.is_authenticated and usuario.es_staff
        if not es_staff:
            # El cliente no debe ver productos dados de baja.
            queryset = queryset.filter(disponible=True)
        return queryset

    @extend_schema(request=DisponibilidadSerializer, responses={200: ProductoSerializer})
    @action(detail=True, methods=["patch"])
    def disponibilidad(self, request, slug=None):
        producto = self.get_object()
        serializer = DisponibilidadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producto.disponible = serializer.validated_data["disponible"]
        producto.save(update_fields=["disponible", "actualizado_en"])
        return Response(ProductoSerializer(producto, context={"request": request}).data)
