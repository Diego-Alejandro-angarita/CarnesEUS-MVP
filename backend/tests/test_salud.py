import pytest


@pytest.mark.django_db
def test_salud_responde_ok(api):
    """Prueba de humo: si esto pasa, Django y la base de datos hablan entre si."""
    respuesta = api.get("/api/salud/")

    assert respuesta.status_code == 200
    assert respuesta.data["estado"] == "ok"
    assert respuesta.data["base_de_datos"] is True
