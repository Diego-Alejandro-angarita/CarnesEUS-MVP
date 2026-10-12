from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import ia, servicios

PARAMETROS_RANGO = [
    OpenApiParameter("desde", str, description="AAAA-MM-DD (por defecto, hoy - 30)"),
    OpenApiParameter("hasta", str, description="AAAA-MM-DD (por defecto, hoy)"),
]


class RangoSerializer(serializers.Serializer):
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)

    def validate(self, datos):
        datos.setdefault("hasta", timezone.localdate())
        datos.setdefault("desde", datos["hasta"] - timedelta(days=30))
        if datos["desde"] > datos["hasta"]:
            raise serializers.ValidationError("La fecha inicial no puede ser mayor que la final.")
        return datos


class EstadisticasView(APIView):
    permission_classes = [IsAdminUser]

    def rango(self, request):
        entrada = RangoSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        return entrada.validated_data["desde"], entrada.validated_data["hasta"]


@extend_schema(summary="Resumen de ventas", parameters=PARAMETROS_RANGO)
class ResumenView(EstadisticasView):
    def get(self, request):
        return Response(servicios.resumen(*self.rango(request)))


@extend_schema(summary="Ventas por producto, categoria, barrio y metodo", parameters=PARAMETROS_RANGO)
class ProductosView(EstadisticasView):
    def get(self, request):
        return Response(servicios.productos(*self.rango(request)))


@extend_schema(summary="Clientes segmentados")
class ClientesView(EstadisticasView):
    def get(self, request):
        return Response(servicios.clientes())


@extend_schema(
    summary="Sugerencias y borradores de campaña con IA",
    description="FR-06: sin llave configurada usa reglas fijas. Solo cuenta clientes con autorizacion.",
    parameters=PARAMETROS_RANGO,
)
class SugerenciasView(EstadisticasView):
    def post(self, request):
        return Response(ia.generar(*self.rango(request)))
