import pytest
from django.contrib.auth import get_user_model

Usuario = get_user_model()

pytestmark = pytest.mark.django_db


def test_registro_crea_cliente_e_inicia_sesion(api):
    respuesta = api.post(
        "/api/auth/registro/",
        {
            "email": "nuevo@test.co",
            "nombre_completo": "Persona Nueva",
            "telefono": "3009998877",
            "password": "clave-segura-123",
            "password2": "clave-segura-123",
        },
        format="json",
    )

    assert respuesta.status_code == 201
    assert respuesta.data["email"] == "nuevo@test.co"
    # El rol nunca lo elige quien se registra.
    assert respuesta.data["rol"] == Usuario.Rol.CLIENTE
    assert respuesta.data["es_staff"] is False
    # Queda con sesion abierta: entra directo a la tienda.
    assert api.get("/api/auth/me/").status_code == 200


def test_registro_rechaza_contrasenas_distintas(api):
    respuesta = api.post(
        "/api/auth/registro/",
        {
            "email": "otro@test.co",
            "nombre_completo": "Otro",
            "password": "clave-segura-123",
            "password2": "clave-diferente-456",
        },
        format="json",
    )
    assert respuesta.status_code == 400
    assert "password2" in respuesta.data


def test_registro_no_permite_correo_repetido(api, cliente):
    respuesta = api.post(
        "/api/auth/registro/",
        {
            "email": cliente.email,
            "nombre_completo": "Impostor",
            "password": "clave-segura-123",
            "password2": "clave-segura-123",
        },
        format="json",
    )
    assert respuesta.status_code == 400


def test_la_contrasena_se_guarda_hasheada(cliente):
    cliente.refresh_from_db()
    assert cliente.password != "clave-segura-123"
    assert cliente.check_password("clave-segura-123")


def test_login_y_logout(api, cliente):
    respuesta = api.post(
        "/api/auth/login/",
        {"email": cliente.email, "password": "clave-segura-123"},
        format="json",
    )
    assert respuesta.status_code == 200
    assert api.get("/api/auth/me/").status_code == 200

    assert api.post("/api/auth/logout/").status_code == 204
    assert api.get("/api/auth/me/").status_code == 403


def test_login_con_credenciales_malas_no_revela_si_el_correo_existe(api, cliente):
    respuesta = api.post(
        "/api/auth/login/",
        {"email": cliente.email, "password": "equivocada"},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "Correo o contrasena incorrectos." in str(respuesta.data)


def test_me_requiere_sesion(api):
    assert api.get("/api/auth/me/").status_code == 403


def test_endpoint_csrf_entrega_la_cookie(api):
    respuesta = api.get("/api/auth/csrf/")
    assert respuesta.status_code == 200
    assert "csrftoken" in respuesta.cookies


def test_la_zona_de_cobertura_la_decide_el_backend(api_cliente):
    """FR-15: aunque el cliente mande en_zona_cobertura, manda la ciudad."""
    respuesta = api_cliente.post(
        "/api/auth/direcciones/",
        {
            "etiqueta": "Finca",
            "ciudad": "Cartagena",
            "direccion": "Cra 1 #2-3",
            "en_zona_cobertura": True,
        },
        format="json",
    )
    assert respuesta.status_code == 201
    assert respuesta.data["en_zona_cobertura"] is False


def test_ciudad_con_tilde_se_reconoce(api_cliente):
    respuesta = api_cliente.post(
        "/api/auth/direcciones/",
        {"etiqueta": "Casa", "ciudad": "Itagui", "direccion": "Cll 50 #40-10"},
        format="json",
    )
    assert respuesta.data["en_zona_cobertura"] is True


def test_cada_usuario_ve_solo_sus_direcciones(api_staff, direccion):
    respuesta = api_staff.get("/api/auth/direcciones/")
    assert respuesta.status_code == 200
    assert respuesta.data == []
