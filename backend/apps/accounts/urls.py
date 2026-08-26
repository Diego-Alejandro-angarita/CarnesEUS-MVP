from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CsrfView, DireccionViewSet, LoginView, LogoutView, MeView, RegistroView

router = DefaultRouter()
router.register("direcciones", DireccionViewSet, basename="direccion")

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="csrf"),
    path("registro/", RegistroView.as_view(), name="registro"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
