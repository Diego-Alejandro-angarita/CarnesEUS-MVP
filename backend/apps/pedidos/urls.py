from django.urls import path

from .views import (
    CambiarEstadoPedidoView,
    CambiarEtapaPedidoView,
    ConsultarPedidoView,
    CrearPedidoView,
    MiPedidoDetalleView,
    MisPedidosView,
    PedidoDetalleView,
    PedidoListView,
)

app_name = "pedidos"

urlpatterns = [
    path("pedidos/", CrearPedidoView.as_view(), name="crear"),
    path("pedidos/admin/", PedidoListView.as_view(), name="admin-lista"),
    path("pedidos/admin/<int:pk>/", PedidoDetalleView.as_view(), name="admin-detalle"),
    path(
        "pedidos/admin/<int:pk>/cambiar-estado/",
        CambiarEstadoPedidoView.as_view(),
        name="admin-cambiar-estado",
    ),
    path(
        "pedidos/admin/<int:pk>/cambiar-etapa/",
        CambiarEtapaPedidoView.as_view(),
        name="admin-cambiar-etapa",
    ),
    path("pedidos/mios/", MisPedidosView.as_view(), name="mios"),
    path("pedidos/mios/<int:pk>/", MiPedidoDetalleView.as_view(), name="mio-detalle"),
    path("pedidos/consultar/", ConsultarPedidoView.as_view(), name="consultar"),
]