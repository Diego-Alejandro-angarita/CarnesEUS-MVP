from django.urls import path

from .views import CategoriaListView, ProductoAdminDetalleView, ProductoListView

app_name = "catalog"

urlpatterns = [
    path("productos/", ProductoListView.as_view(), name="productos-lista"),
    path(
        "productos/<int:pk>/",
        ProductoAdminDetalleView.as_view(),
        name="productos-admin-detalle",
    ),
    path("categorias/", CategoriaListView.as_view(), name="categorias-lista"),
]
