from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class SaludView(APIView):
    """
    Comprobacion de que el stack completo responde.

    Existe solo para verificar la instalacion: Angular llama a /api/salud/ a
    traves del proxy y este endpoint toca la base de datos. Si responde, las
    tres piezas estan conectadas. Se puede borrar sin consecuencias.
    """

    permission_classes = [AllowAny]

    @extend_schema(responses={200: None})
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            base_de_datos = cursor.fetchone() == (1,)

        return Response({"estado": "ok", "base_de_datos": base_de_datos})
