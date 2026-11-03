import importlib

import pytest

from apps.accounts.models import Usuario

forward = importlib.import_module(
    "apps.accounts.migrations.0002_usuario_tutoriales_vistos"
).forward


def _login(api, email="ana@example.com", password="UnaClaveSegura123"):
    Usuario.objects.create_user(email=email, password=password)
    return api.post("/api/auth/login/", {"email": email, "password": password})


@pytest.mark.django_db
def test_login_incluye_tutoriales_vistos_vacio_en_cuenta_nueva(api):
    respuesta = _login(api)

    assert respuesta.status_code == 200
    assert respuesta.data["tutoriales_vistos"] == []


@pytest.mark.django_db
def test_quien_soy_incluye_tutoriales_vistos_vacio_en_cuenta_nueva(api):
    _login(api)

    respuesta = api.get("/api/auth/quien-soy/")

    assert respuesta.status_code == 200
    assert respuesta.data["tutoriales_vistos"] == []


@pytest.mark.django_db
def test_post_clave_valida_la_agrega(api):
    _login(api)

    respuesta = api.post("/api/auth/tutoriales/vistos/", {"claves": ["admin.productos"]})

    assert respuesta.status_code == 200
    assert respuesta.data["tutoriales_vistos"] == ["admin.productos"]
    usuario = Usuario.objects.get(email="ana@example.com")
    assert usuario.tutoriales_vistos == ["admin.productos"]


@pytest.mark.django_db
def test_post_repetido_no_duplica(api):
    _login(api)

    api.post("/api/auth/tutoriales/vistos/", {"claves": ["admin.productos"]})
    respuesta = api.post("/api/auth/tutoriales/vistos/", {"claves": ["admin.productos"]})

    assert respuesta.status_code == 200
    assert respuesta.data["tutoriales_vistos"] == ["admin.productos"]


@pytest.mark.django_db
def test_post_varias_claves_las_agrega_todas(api):
    _login(api)

    respuesta = api.post(
        "/api/auth/tutoriales/vistos/",
        {"claves": ["admin.panel", "admin.productos", "admin.pedidos"]},
    )

    assert respuesta.status_code == 200
    assert respuesta.data["tutoriales_vistos"] == [
        "admin.panel",
        "admin.pedidos",
        "admin.productos",
    ]


@pytest.mark.django_db
def test_post_clave_invalida_devuelve_400_y_no_guarda_nada(api):
    _login(api)

    respuesta = api.post("/api/auth/tutoriales/vistos/", {"claves": ["no-existe"]})

    assert respuesta.status_code == 400
    usuario = Usuario.objects.get(email="ana@example.com")
    assert usuario.tutoriales_vistos == []


@pytest.mark.django_db
def test_post_sin_sesion_devuelve_403(api):
    respuesta = api.post("/api/auth/tutoriales/vistos/", {"claves": ["cliente"]})

    assert respuesta.status_code == 403


@pytest.mark.django_db
def test_endpoint_solo_toca_al_usuario_de_la_sesion(api):
    otro = Usuario.objects.create_user(
        email="otro@example.com", password="UnaClaveSegura123"
    )
    _login(api)

    respuesta = api.post("/api/auth/tutoriales/vistos/", {"claves": ["cliente"]})

    assert respuesta.status_code == 200
    assert respuesta.data["email"] == "ana@example.com"
    otro.refresh_from_db()
    assert otro.tutoriales_vistos == []


@pytest.mark.django_db
def test_migracion_marca_cliente_solo_a_usuarios_con_last_login(api):
    from django.utils import timezone

    con_login = Usuario.objects.create_user(
        email="con@example.com", password="UnaClaveSegura123"
    )
    con_login.last_login = timezone.now()
    con_login.save(update_fields=["last_login"])
    sin_login = Usuario.objects.create_user(
        email="sin@example.com", password="UnaClaveSegura123"
    )

    from django.apps import apps as django_apps

    forward(django_apps, None)

    con_login.refresh_from_db()
    sin_login.refresh_from_db()
    assert con_login.tutoriales_vistos == ["cliente"]
    assert sin_login.tutoriales_vistos == []
