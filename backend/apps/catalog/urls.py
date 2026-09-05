from django.urls import path

from .views import ProductoListView

app_name = "catalog"

urlpatterns = [
    path("productos/", ProductoListView.as_view(), name="productos-lista"),
]
