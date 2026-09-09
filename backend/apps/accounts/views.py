from django.contrib.auth import login
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Usuario
from .serializers import LoginSerializer, RegistroSerializer, UsuarioSerializer


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
