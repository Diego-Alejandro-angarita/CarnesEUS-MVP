from django.urls import path

from .views import ClientesView, ProductosView, ResumenView, SugerenciasView

app_name = "estadisticas"

urlpatterns = [
    path("estadisticas/resumen/", ResumenView.as_view(), name="resumen"),
    path("estadisticas/productos/", ProductosView.as_view(), name="productos"),
    path("estadisticas/clientes/", ClientesView.as_view(), name="clientes"),
    path("estadisticas/sugerencias/", SugerenciasView.as_view(), name="sugerencias"),
]
