from django.urls import path

from .views import PuedeResenarView, ResenaDetalleView, ResenaListCrearView

app_name = "resenas"

urlpatterns = [
    path(
        "productos/<slug:producto_slug>/resenas/",
        ResenaListCrearView.as_view(),
        name="resenas-lista",
    ),
    path(
        "productos/<slug:producto_slug>/resenas/puede-resenar/",
        PuedeResenarView.as_view(),
        name="resenas-puede-resenar",
    ),
    path("resenas/<int:pk>/", ResenaDetalleView.as_view(), name="resenas-detalle"),
]
