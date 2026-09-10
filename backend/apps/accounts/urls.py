from django.urls import path

from .views import LoginView, LogoutView, QuienSoyView, RegistroView

urlpatterns = [
    path("registro/", RegistroView.as_view(), name="registro"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("quien-soy/", QuienSoyView.as_view(), name="quien-soy"),
]
