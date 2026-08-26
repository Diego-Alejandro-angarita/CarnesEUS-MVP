from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CarritoView, ItemCarritoViewSet, PedidoViewSet

router = DefaultRouter()
router.register("carrito/items", ItemCarritoViewSet, basename="item-carrito")
router.register("pedidos", PedidoViewSet, basename="pedido")

urlpatterns = [
    path("carrito/", CarritoView.as_view(), name="carrito"),
    path("", include(router.urls)),
]
