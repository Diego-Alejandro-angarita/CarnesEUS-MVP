from django.urls import path

from .views import VerificarCoberturaView, ZonasView

app_name = "cobertura"

urlpatterns = [
    path("cobertura/", VerificarCoberturaView.as_view(), name="verificar"),
    path("cobertura/zonas/", ZonasView.as_view(), name="zonas"),
]