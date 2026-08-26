from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Direccion
from .serializers import (
    DireccionSerializer,
    LoginSerializer,
    RegistroSerializer,
    UsuarioSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """
    Entrega la cookie csrftoken.

    Angular llama a este endpoint al arrancar: sin la cookie, el primer POST
    (incluido el login) seria rechazado.
    """

    permission_classes = [AllowAny]

    @extend_schema(responses={200: None})
    def get(self, request):
        return Response({"detail": "Cookie CSRF establecida."})


# DRF exime del middleware CSRF y solo lo aplica a usuarios ya autenticados.
# csrf_protect lo reactiva para registro y login, que son anonimos.
@method_decorator(csrf_protect, name="dispatch")
class RegistroView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RegistroSerializer, responses={201: UsuarioSerializer})
    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        # Se inicia sesion de una vez: el usuario entra directo a la tienda.
        login(request, usuario)
        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LoginSerializer, responses={200: UsuarioSerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        login(request, usuario)
        return Response(UsuarioSerializer(usuario).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UsuarioSerializer})
    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)

    @extend_schema(request=UsuarioSerializer, responses={200: UsuarioSerializer})
    def patch(self, request):
        serializer = UsuarioSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DireccionViewSet(viewsets.ModelViewSet):
    # Necesario para que drf-spectacular deduzca el modelo sin ejecutar
    # get_queryset(), que depende del usuario autenticado.
    queryset = Direccion.objects.none()
    serializer_class = DireccionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Cada quien ve solo sus direcciones.
        return Direccion.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
