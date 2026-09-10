from django.urls import path

from .views import AgregarItemView, CarritoView, ItemDetalleView

app_name = "cart"

urlpatterns = [
    path("carrito/", CarritoView.as_view(), name="carrito"),
    path("carrito/items/", AgregarItemView.as_view(), name="carrito-items"),
    path("carrito/items/<int:pk>/", ItemDetalleView.as_view(), name="carrito-item-detalle"),
]