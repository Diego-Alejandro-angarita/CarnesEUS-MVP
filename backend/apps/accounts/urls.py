from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    QuienSoyView,
    RegistroView,
    UsuarioDetalleView,
    UsuarioListView,
)

urlpatterns = [
    path("registro/", RegistroView.as_view(), name="registro"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("quien-soy/", QuienSoyView.as_view(), name="quien-soy"),
    path("usuarios/", UsuarioListView.as_view(), name="usuarios-lista"),
    path("usuarios/<int:pk>/", UsuarioDetalleView.as_view(), name="usuarios-detalle"),
]
