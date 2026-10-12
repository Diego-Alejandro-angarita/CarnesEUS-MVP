"""
FR-04 Modificar producto: pruebas golden.

Comparan la respuesta completa de la API con un archivo de referencia en
golden/. Si un cambio en el contrato es intencional, se regeneran con:

    ACTUALIZAR_GOLDEN=1 pytest tests/funcionalidades/test_fr04_modificar_producto_golden.py

y el diff de los .json se revisa en el pull request como cualquier otro cambio.
"""

import json
import os
from pathlib import Path

import pytest

from apps.accounts.models import Usuario

GOLDEN = Path(__file__).parent / "golden"


# Campos con ids de la base: cambian entre corridas, asi que se comparan por tipo.
IDS = ("id", "categoria")


def normalizar(datos):
    estable = {
        campo: f"<{type(valor).__name__}>" if campo in IDS else valor
        for campo, valor in datos.items()
    }
    return json.dumps(estable, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def comparar_con_golden(nombre, datos):
    archivo = GOLDEN / f"{nombre}.json"
    obtenido = normalizar(datos)

    if os.environ.get("ACTUALIZAR_GOLDEN"):
        archivo.parent.mkdir(exist_ok=True)
        archivo.write_text(obtenido, encoding="utf-8", newline="\n")

    assert archivo.exists(), f"Falta {archivo.name}; generalo con ACTUALIZAR_GOLDEN=1"
    assert obtenido == archivo.read_text(encoding="utf-8")


@pytest.fixture
def api(api):
    """Modificar un producto requiere personal (FR-19)."""
    staff = Usuario.objects.create_user(email="staff@carneseus.test", password="x", is_staff=True)
    api.force_authenticate(staff)
    return api


@pytest.mark.django_db
def test_la_modificacion_responde_el_contrato_que_espera_el_formulario(api, crear_producto):
    lomo = crear_producto("Lomo fino")

    respuesta = api.patch(
        f"/api/productos/{lomo.id}/",
        {"nombre": "Lomo fino madurado", "precio": "41500", "disponible": False},
        format="json",
    )

    assert respuesta.status_code == 200
    comparar_con_golden("fr04_modificacion_exitosa", respuesta.data)


@pytest.mark.django_db
def test_los_errores_de_validacion_responden_el_contrato_que_espera_el_formulario(
    api, crear_producto
):
    lomo = crear_producto("Lomo fino")
    crear_producto("Punta de anca")

    respuesta = api.patch(
        f"/api/productos/{lomo.id}/",
        {"slug": "punta-de-anca", "precio": "0"},
        format="json",
    )

    assert respuesta.status_code == 400
    comparar_con_golden("fr04_modificacion_rechazada", respuesta.data)
    lomo.refresh_from_db()
    assert (lomo.slug, str(lomo.precio)) == ("lomo-fino", "38900.00")
