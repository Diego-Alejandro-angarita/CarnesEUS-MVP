import pytest

from apps.accounts.models import Usuario


@pytest.mark.django_db
def test_registro_crea_usuario_y_no_expone_password(api):
    datos = {
        "first_name": "Ana",
        "last_name": "Gomez",
        "email": "ana@example.com",
        "telefono": "3001234567",
        "password": "UnaClaveSegura123",
        "password_confirmacion": "UnaClaveSegura123",
    }

    respuesta = api.post("/api/auth/registro/", datos)

    assert respuesta.status_code == 201
    assert "password" not in respuesta.data
    usuario = Usuario.objects.get(email="ana@example.com")
    assert usuario.check_password("UnaClaveSegura123")


@pytest.mark.django_db
def test_registro_rechaza_correo_duplicado(api):
    Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")

    respuesta = api.post(
        "/api/auth/registro/",
        {
            "first_name": "Otra",
            "last_name": "Persona",
            "email": "ana@example.com",
            "password": "OtraClaveSegura123",
            "password_confirmacion": "OtraClaveSegura123",
        },
    )

    assert respuesta.status_code == 400
    assert "email" in respuesta.data


@pytest.mark.django_db
def test_registro_rechaza_contrasenas_que_no_coinciden(api):
    respuesta = api.post(
        "/api/auth/registro/",
        {
            "first_name": "Ana",
            "last_name": "Gomez",
            "email": "ana2@example.com",
            "password": "UnaClaveSegura123",
            "password_confirmacion": "otra-distinta",
        },
    )

    assert respuesta.status_code == 400
    assert "password_confirmacion" in respuesta.data


@pytest.mark.django_db
def test_registro_rechaza_contrasena_debil(api):
    respuesta = api.post(
        "/api/auth/registro/",
        {
            "first_name": "Ana",
            "last_name": "Gomez",
            "email": "ana3@example.com",
            "password": "12345678",
            "password_confirmacion": "12345678",
        },
    )

    assert respuesta.status_code == 400
    assert "password" in respuesta.data
