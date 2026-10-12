from django.urls import path

from .views import (
    CrearPedidoView,
    MarcarPedidoPagadoView,
    PedidoDetalleView,
    PedidoListView,
)

app_name = "pedidos"

urlpatterns = [
    path("pedidos/", CrearPedidoView.as_view(), name="crear"),
    path("pedidos/admin/", PedidoListView.as_view(), name="admin-lista"),
    path("pedidos/admin/<int:pk>/", PedidoDetalleView.as_view(), name="admin-detalle"),
    path(
        "pedidos/admin/<int:pk>/marcar-pagado/",
        MarcarPedidoPagadoView.as_view(),
        name="admin-marcar-pagado",
    ),
]