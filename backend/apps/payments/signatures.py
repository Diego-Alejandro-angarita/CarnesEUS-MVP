"""
Las dos piezas criptograficas de la integracion con Wompi.

Son pocas lineas, pero de ellas depende que nadie pague de menos ni pueda
marcar pedidos como pagados por su cuenta. Tienen pruebas propias en
tests/test_signatures.py.
"""

import hashlib
import hmac


def firma_integridad(referencia, monto_en_centavos, moneda, secreto, expira_en=None):
    """
    Firma que el Widget envia a Wompi para verificar que el monto no fue
    alterado en el navegador.

        SHA256(referencia + monto + moneda [+ expiracion] + secreto_integridad)

    Se calcula SIEMPRE en el servidor. Si se calculara en Angular, el secreto
    quedaria en el bundle y cualquiera podria cobrarse lo que quisiera.
    """
    cadena = f"{referencia}{monto_en_centavos}{moneda}"
    if expira_en:
        cadena += expira_en
    cadena += secreto
    return hashlib.sha256(cadena.encode("utf-8")).hexdigest()


def _resolver_ruta(datos, ruta):
    """Resuelve 'transaction.status' dentro del bloque data del evento."""
    valor = datos
    for parte in ruta.split("."):
        if not isinstance(valor, dict) or parte not in valor:
            raise KeyError(f"El evento no trae la propiedad '{ruta}'.")
        valor = valor[parte]
    return valor


def checksum_evento(payload, secreto):
    """
    Checksum que Wompi calcula para cada evento:

        SHA256(valores de signature.properties + timestamp + secreto_eventos)

    Las propiedades llegan como rutas dentro de 'data' y hay que concatenarlas
    en el orden exacto en que vienen.
    """
    firma = payload.get("signature") or {}
    propiedades = firma.get("properties") or []
    if not propiedades:
        raise KeyError("El evento no trae signature.properties.")

    datos = payload.get("data") or {}
    cadena = "".join(str(_resolver_ruta(datos, ruta)) for ruta in propiedades)
    cadena += f"{payload['timestamp']}{secreto}"
    return hashlib.sha256(cadena.encode("utf-8")).hexdigest()


def evento_es_autentico(payload, secreto, checksum_recibido=None):
    """
    Verifica que el evento venga realmente de Wompi.

    Sin esta validacion, cualquiera podria marcar pedidos como pagados con un
    simple POST al webhook.
    """
    if not secreto:
        return False
    try:
        esperado = checksum_evento(payload, secreto)
    except (KeyError, TypeError):
        return False

    recibido = checksum_recibido or (payload.get("signature") or {}).get("checksum") or ""
    # Comparacion en tiempo constante: no filtra informacion por cuanto tarda.
    return hmac.compare_digest(esperado.lower(), str(recibido).lower())
