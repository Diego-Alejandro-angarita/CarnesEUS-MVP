from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Usuario
from .serializers import RegistroSerializer


class RegistroView(generics.CreateAPIView):
    """Alta publica de clientes nuevos."""

    queryset = Usuario.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]
