from django.contrib.auth import login, logout
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Usuario
from .serializers import (
    LoginSerializer,
    RegistroSerializer,
    UsuarioAdminSerializer,
    UsuarioSerializer,
)


class RegistroView(generics.CreateAPIView):
    """Alta publica de clientes nuevos."""

    queryset = Usuario.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]


class LoginView(APIView):
    """Inicio de sesion de un cliente ya registrado."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]

        login(request, usuario)

        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Cierre de sesion del cliente."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuienSoyView(APIView):
    """Datos del cliente con sesion activa.

    El frontend la consulta al arrancar para saber si ya hay sesion.
    """

    # Sin permission_classes: usa el default IsAuthenticated, asi devuelve
    # 403 solo si no hay sesion.

    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)


class UsuarioListView(generics.ListAPIView):
    """Listado de clientes registrados, para el panel administrativo (FR-19)."""

    permission_classes = [IsAdminUser]
    serializer_class = UsuarioAdminSerializer
    queryset = Usuario.objects.all().order_by("-date_joined")


class UsuarioDetalleView(generics.RetrieveUpdateAPIView):
    """
    Activar o desactivar una cuenta (FR-19).

    Un usuario desactivado no puede iniciar sesion: lo bloquea el backend de
    autenticacion de Django, no hace falta nada extra aqui.
    """

    permission_classes = [IsAdminUser]
    serializer_class = UsuarioAdminSerializer
    queryset = Usuario.objects.all()
