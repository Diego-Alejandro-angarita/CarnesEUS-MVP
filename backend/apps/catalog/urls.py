from django.urls import path

from .views import ProductoDetalleView, ProductoListView

app_name = "catalog"

urlpatterns = [
    path("productos/", ProductoListView.as_view(), name="productos-lista"),
    path("productos/<slug:slug>/", ProductoDetalleView.as_view(), name="productos-detalle"),
]
