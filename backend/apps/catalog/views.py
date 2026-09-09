from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import AllowAny

from .models import Categoria, Producto
from .serializers import CategoriaSerializer, ProductoAdminSerializer, ProductoSerializer


@extend_schema_view(
    get=extend_schema(
        summary="Listado paginado del catalogo",
        description=(
            "Devuelve los productos del catalogo con foto, precio y disponibilidad. "
            "Acepta los parametros page y page_size."
        ),
        responses={200: ProductoSerializer(many=True)},
    ),
    post=extend_schema(
        summary="Crear un producto",
        description=(
            "Da de alta un producto desde la interfaz de administracion. El slug se "
            "calcula a partir del nombre si no se envia."
        ),
        request=ProductoAdminSerializer,
        responses={201: ProductoAdminSerializer},
    ),
)
class ProductoListView(ListCreateAPIView):
    # TODO(FR-02): restringir el POST a IsAdminUser cuando exista el inicio de
    # sesion. Hoy la creacion queda abierta porque todavia no hay autenticacion.
    permission_classes = [AllowAny]
    queryset = Producto.objects.visibles().select_related("categoria")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductoAdminSerializer
        return ProductoSerializer


@extend_schema(
    summary="Listado de categorias",
    description="Categorias disponibles para clasificar un producto. No viene paginado.",
    responses={200: CategoriaSerializer(many=True)},
)
class CategoriaListView(ListAPIView):
    serializer_class = CategoriaSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    queryset = Categoria.objects.all()


@extend_schema(
    summary="Ficha de un producto",
    description="Devuelve el detalle completo de un producto a partir de su slug.",
    responses={200: ProductoSerializer},
)
class ProductoDetalleView(RetrieveAPIView):
    """Ficha publica (FR-16), buscada por slug."""

    serializer_class = ProductoSerializer
    permission_classes = [AllowAny]
    # Sin .visibles(): un producto archivado desaparece del catalogo pero su
    # ficha sigue respondiendo, para no romper enlaces que ya circulan.
    queryset = Producto.objects.select_related("categoria")
    lookup_field = "slug"


@extend_schema_view(
    get=extend_schema(
        summary="Datos de un producto para editarlo",
        description=(
            "Devuelve el producto con la categoria como id, que es lo que necesita el "
            "formulario de administracion para rellenarse."
        ),
        responses={200: ProductoAdminSerializer},
    ),
    put=extend_schema(
        summary="Reemplazar un producto",
        request=ProductoAdminSerializer,
        responses={200: ProductoAdminSerializer},
    ),
    patch=extend_schema(
        summary="Modificar un producto",
        description=(
            "Actualiza los campos enviados. El slug se conserva salvo que se mande uno "
            "nuevo, para no romper los enlaces del catalogo."
        ),
        request=ProductoAdminSerializer,
        responses={200: ProductoAdminSerializer},
    ),
    delete=extend_schema(
        summary="Eliminar un producto",
        description=(
            "Archiva el producto: desaparece del catalogo y de la administracion, pero "
            "la ficha se conserva para lo que ya la referencie. Se puede recuperar desde "
            "el admin de Django."
        ),
        responses={204: None},
    ),
)
class ProductoAdminDetalleView(RetrieveUpdateDestroyAPIView):
    """Edicion (FR-04) y eliminacion (FR-05) de un producto por id."""

    serializer_class = ProductoAdminSerializer
    permission_classes = [AllowAny]
    queryset = Producto.objects.visibles().select_related("categoria")

    def perform_destroy(self, instance):
        instance.archivado = True
        instance.save(update_fields=["archivado", "actualizado_en"])