from django.urls import path

from .views import ProductoOpcionListView, PromocionDetalleView, PromocionListView

app_name = "promotions"

urlpatterns = [
    path("promociones/", PromocionListView.as_view(), name="promociones-lista"),
    path(
        "promociones/productos/",
        ProductoOpcionListView.as_view(),
        name="promociones-productos",
    ),
    path(
        "promociones/<int:pk>/",
        PromocionDetalleView.as_view(),
        name="promociones-detalle",
    ),
]
