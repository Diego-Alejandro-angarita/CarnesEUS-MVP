from rest_framework import serializers


class DatosClienteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    fullName = serializers.CharField()
    phoneNumber = serializers.CharField(allow_blank=True)
    phoneNumberPrefix = serializers.CharField()


class DatosWidgetSerializer(serializers.Serializer):
    """Lo que Angular le pasa al Widget de Wompi."""

    publicKey = serializers.CharField()
    currency = serializers.CharField()
    amountInCents = serializers.IntegerField()
    reference = serializers.CharField()
    signature = serializers.CharField()
    redirectUrl = serializers.URLField()
    customerData = DatosClienteSerializer()
    shippingAddress = serializers.DictField()


class VerificarPagoSerializer(serializers.Serializer):
    transaction_id = serializers.CharField(required=False, allow_blank=True, default="")


class ResultadoVerificacionSerializer(serializers.Serializer):
    pedido = serializers.DictField()
    estado_pago = serializers.CharField(allow_null=True)
