from django.urls import path

from .views import CategoriaListView, ProductoListView

app_name = "catalog"

urlpatterns = [
    path("productos/", ProductoListView.as_view(), name="productos-lista"),
    path("categorias/", CategoriaListView.as_view(), name="categorias-lista"),
]
