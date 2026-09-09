from django.urls import path

from .views import (
    CategoriaListView,
    ProductoAdminDetalleView,
    ProductoDetalleView,
    ProductoListView,
)

app_name = "catalog"

urlpatterns = [
    path("productos/", ProductoListView.as_view(), name="productos-lista"),
    # El patron <int:pk> va antes que <slug:slug>: solo casa con digitos, asi
    # que no le roba las URLs a la ficha publica.
    path(
        "productos/<int:pk>/",
        ProductoAdminDetalleView.as_view(),
        name="productos-admin-detalle",
    ),
    path(
        "productos/<slug:slug>/",
        ProductoDetalleView.as_view(),
        name="productos-detalle",
    ),
    path("categorias/", CategoriaListView.as_view(), name="categorias-lista"),
]