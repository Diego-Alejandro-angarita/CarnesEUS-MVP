from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ZonaCobertura
from .serializers import (
    ConsultaCoberturaSerializer,
    RespuestaCoberturaSerializer,
    ZonaSerializer,
)

MENSAJE_CUBIERTA = "Hacemos domicilios a este barrio."
MENSAJE_SIN_COBERTURA = "Por ahora no hacemos domicilios a este barrio."


@extend_schema(
    summary="Consultar si una direccion esta en la zona de cobertura",
    description=(
        "Dice si hay domicilios al barrio indicado. La comparacion ignora "
        "tildes y mayusculas. Es publica: el cliente puede consultarla antes "
        "de registrarse o de pagar."
    ),
    parameters=[
        OpenApiParameter("municipio", str, required=True),
        OpenApiParameter("barrio", str, required=True),
    ],
    responses={200: RespuestaCoberturaSerializer},
)
class VerificarCoberturaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        consulta = ConsultaCoberturaSerializer(data=request.query_params)
        consulta.is_valid(raise_exception=True)
        municipio = consulta.validated_data["municipio"].strip()
        barrio = consulta.validated_data["barrio"].strip()

        cubierta = ZonaCobertura.cubre(municipio, barrio)
        respuesta = {
            "cubierta": cubierta,
            "municipio": municipio,
            "barrio": barrio,
            "mensaje": MENSAJE_CUBIERTA if cubierta else MENSAJE_SIN_COBERTURA,
        }
        return Response(RespuestaCoberturaSerializer(respuesta).data)


@extend_schema(
    summary="Barrios con cobertura",
    description="Lista (sin paginar) los barrios activos. Sirve para sugerir mientras se escribe.",
)
class ZonasView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ZonaSerializer
    pagination_class = None
    queryset = ZonaCobertura.objects.filter(activa=True)