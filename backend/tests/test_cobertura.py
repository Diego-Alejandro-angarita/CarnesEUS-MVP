import pytest
from django.core.management import call_command

from apps.cobertura.models import ZonaCobertura, normalizar


@pytest.fixture
def laureles(db):
    return ZonaCobertura.objects.create(municipio="Medellin", barrio="Laureles")


def consultar(api, municipio, barrio):
    return api.get("/api/cobertura/", {"municipio": municipio, "barrio": barrio})


# --- normalizacion -----------------------------------------------------------


def test_normalizar_quita_tildes_mayusculas_y_espacios():
    assert normalizar("  Medellín ") == "medellin"
    assert normalizar("EL   POBLADO") == "el poblado"
    assert normalizar("Belén") == normalizar("belen")


# --- modelo ------------------------------------------------------------------


@pytest.mark.django_db
def test_guardar_calcula_la_clave():
    zona = ZonaCobertura.objects.create(municipio="Medellín", barrio="Belén")

    assert zona.clave == "medellin|belen"


@pytest.mark.django_db
def test_no_deja_repetir_la_misma_zona_con_otra_ortografia(laureles):
    from django.db import IntegrityError, transaction

    with pytest.raises(IntegrityError), transaction.atomic():
        ZonaCobertura.objects.create(municipio="MEDELLÍN", barrio="laureles")


@pytest.mark.django_db
def test_cubre_ignora_tildes_y_mayusculas(laureles):
    assert ZonaCobertura.cubre("medellín", "LAURELES") is True


@pytest.mark.django_db
def test_una_zona_inactiva_no_cubre(laureles):
    laureles.activa = False
    laureles.save(update_fields=["activa"])

    assert ZonaCobertura.cubre("Medellin", "Laureles") is False


# --- API: verificar ------------------------------------------------------------


@pytest.mark.django_db
def test_barrio_con_cobertura(api, laureles):
    respuesta = consultar(api, "Medellin", "Laureles")

    assert respuesta.status_code == 200
    assert respuesta.data["cubierta"] is True
    assert respuesta.data["mensaje"]


@pytest.mark.django_db
def test_barrio_sin_cobertura(api, laureles):
    respuesta = consultar(api, "Medellin", "Robledo")

    assert respuesta.status_code == 200
    assert respuesta.data["cubierta"] is False


@pytest.mark.django_db
def test_el_mismo_barrio_en_otro_municipio_no_cuenta(api, laureles):
    ZonaCobertura.objects.create(municipio="Envigado", barrio="Centro")

    assert consultar(api, "Envigado", "Centro").data["cubierta"] is True
    assert consultar(api, "Medellin", "Centro").data["cubierta"] is False


@pytest.mark.django_db
def test_la_consulta_es_publica(api, laureles):
    # El cliente la usa antes de registrarse; no puede pedir sesion.
    assert consultar(api, "Medellin", "Laureles").status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("parametros", [{}, {"municipio": "Medellin"}, {"barrio": "Laureles"}])
def test_faltan_datos_responde_400(api, parametros):
    respuesta = api.get("/api/cobertura/", parametros)

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_espacios_alrededor_no_cambian_el_resultado(api, laureles):
    respuesta = consultar(api, "  Medellin ", " Laureles  ")

    assert respuesta.data["cubierta"] is True
    # Devuelve lo que se consulto, recortado, para pintarlo tal cual.
    assert respuesta.data["barrio"] == "Laureles"


# --- API: zonas ----------------------------------------------------------------


@pytest.mark.django_db
def test_lista_solo_las_zonas_activas(api, laureles):
    ZonaCobertura.objects.create(municipio="Medellin", barrio="Robledo", activa=False)

    respuesta = api.get("/api/cobertura/zonas/")

    assert respuesta.status_code == 200
    assert respuesta.data == [{"municipio": "Medellin", "barrio": "Laureles"}]


# --- comando ---------------------------------------------------------------------


@pytest.mark.django_db
def test_cargar_cobertura_se_puede_repetir_sin_duplicar():
    call_command("cargar_cobertura")
    primera = ZonaCobertura.objects.count()
    call_command("cargar_cobertura")

    assert primera > 0
    assert ZonaCobertura.objects.count() == primera