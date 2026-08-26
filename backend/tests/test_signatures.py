"""
Pruebas de las dos piezas criptograficas de Wompi.

Los vectores salen de los ejemplos de la documentacion oficial
(docs.wompi.co): si algun dia cambia el algoritmo, estas pruebas lo delatan
antes de que llegue a produccion.
"""

import hashlib

from apps.payments.signatures import (
    checksum_evento,
    evento_es_autentico,
    firma_integridad,
)

SECRETO_INTEGRIDAD = "test_integrity_Xg4rTZ0aPbYcWv8L"
SECRETO_EVENTOS = "test_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z"


def _evento(estado="APPROVED", monto=11200000):
    return {
        "event": "transaction.updated",
        "data": {
            "transaction": {
                "id": "1234-1610641025-49201",
                "status": estado,
                "amount_in_cents": monto,
                "reference": "CE-20260821-ABC123-9F3A2B1C",
                "payment_method_type": "CARD",
            }
        },
        "environment": "test",
        "signature": {
            "properties": [
                "transaction.id",
                "transaction.status",
                "transaction.amount_in_cents",
            ],
            "checksum": "",
        },
        "timestamp": 1530291411,
        "sent_at": "2026-08-21T16:45:05.000Z",
    }


def _firmar(evento, secreto=SECRETO_EVENTOS):
    evento["signature"]["checksum"] = checksum_evento(evento, secreto)
    return evento


# ---------------------------------------------------------------------------
# Firma de integridad
# ---------------------------------------------------------------------------


def test_firma_integridad_concatena_en_el_orden_documentado():
    esperado = hashlib.sha256(
        f"CE-001112000000COP{SECRETO_INTEGRIDAD}".encode()
    ).hexdigest()

    assert (
        firma_integridad("CE-0011", 12000000, "COP", SECRETO_INTEGRIDAD) == esperado
    )


def test_firma_integridad_incluye_la_expiracion_cuando_se_pasa():
    expira = "2026-08-21T20:00:00.000Z"
    esperado = hashlib.sha256(
        f"CE-001112000000COP{expira}{SECRETO_INTEGRIDAD}".encode()
    ).hexdigest()

    assert (
        firma_integridad("CE-0011", 12000000, "COP", SECRETO_INTEGRIDAD, expira)
        == esperado
    )


def test_cambiar_el_monto_cambia_la_firma():
    """Es justo lo que impide que alguien edite el monto en el navegador."""
    original = firma_integridad("CE-0011", 12000000, "COP", SECRETO_INTEGRIDAD)
    alterada = firma_integridad("CE-0011", 100, "COP", SECRETO_INTEGRIDAD)
    assert original != alterada


# ---------------------------------------------------------------------------
# Checksum del webhook
# ---------------------------------------------------------------------------


def test_checksum_sigue_la_formula_de_la_documentacion():
    evento = _evento()
    esperado = hashlib.sha256(
        f"1234-1610641025-49201APPROVED11200000{evento['timestamp']}{SECRETO_EVENTOS}".encode()
    ).hexdigest()

    assert checksum_evento(evento, SECRETO_EVENTOS) == esperado


def test_evento_bien_firmado_se_acepta():
    evento = _firmar(_evento())
    assert evento_es_autentico(evento, SECRETO_EVENTOS) is True


def test_evento_manipulado_se_rechaza():
    """Cambiar el estado despues de firmar invalida el checksum."""
    evento = _firmar(_evento(estado="DECLINED"))
    evento["data"]["transaction"]["status"] = "APPROVED"
    assert evento_es_autentico(evento, SECRETO_EVENTOS) is False


def test_monto_alterado_se_rechaza():
    evento = _firmar(_evento(monto=11200000))
    evento["data"]["transaction"]["amount_in_cents"] = 100
    assert evento_es_autentico(evento, SECRETO_EVENTOS) is False


def test_con_otro_secreto_se_rechaza():
    evento = _firmar(_evento())
    assert evento_es_autentico(evento, "test_events_secreto_ajeno") is False


def test_sin_secreto_configurado_nunca_se_acepta():
    """Sin llave no se valida nada: no puede pasar por defecto."""
    evento = _firmar(_evento())
    assert evento_es_autentico(evento, "") is False


def test_evento_incompleto_se_rechaza_sin_reventar():
    assert evento_es_autentico({"data": {}}, SECRETO_EVENTOS) is False
    assert evento_es_autentico({}, SECRETO_EVENTOS) is False


def test_se_prefiere_el_checksum_del_header():
    evento = _evento()
    correcto = checksum_evento(evento, SECRETO_EVENTOS)
    evento["signature"]["checksum"] = "basura"

    assert evento_es_autentico(evento, SECRETO_EVENTOS, correcto) is True
    assert evento_es_autentico(evento, SECRETO_EVENTOS, "basura") is False
