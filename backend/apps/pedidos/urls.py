from django.urls import path

from .views import CrearPedidoView

app_name = "pedidos"

urlpatterns = [
    path("pedidos/", CrearPedidoView.as_view(), name="crear"),
]