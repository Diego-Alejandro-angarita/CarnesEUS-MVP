"""
FR-19 Activar y desactivar cuentas: pruebas de integracion del acceso.

A diferencia de las unitarias del panel, aqui nadie usa `force_authenticate`:
cada persona tiene su propio cliente HTTP y entra con correo y contrasena por
`/api/auth/login/`, como lo haria el navegador. Asi se comprueba que el cambio
de `is_active` corta (o devuelve) el acceso real, incluida una sesion que ya
estaba abierta cuando el personal desactivo la cuenta.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Usuario

pytestmark = pytest.mark.django_db

CLAVE = "UnaClaveSegura123"


@pytest.fixture
def ana(db):
    return Usuario.objects.create_user(email="ana@example.com", password=CLAVE)


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(email="staff@carneseus.test", password=CLAVE, is_staff=True)


def entrar(email: str) -> tuple[APIClient, int]:
    """Abre una sesion nueva y devuelve el cliente y el codigo del login."""
    cliente = APIClient()
    respuesta = cliente.post("/api/auth/login/", {"email": email, "password": CLAVE})
    return cliente, respuesta.status_code


def cambiar_activo(panel: APIClient, usuario: Usuario, activo: bool):
    return panel.patch(f"/api/auth/usuarios/{usuario.id}/", {"is_active": activo}, format="json")


@pytest.fixture
def panel(staff):
    """Sesion real del personal que maneja el panel."""
    cliente, codigo = entrar(staff.email)
    assert codigo == 200
    return cliente


# --- una cuenta activa tiene acceso -----------------------------------------------


def test_una_cuenta_activa_inicia_sesion_y_ve_sus_datos(ana):
    navegador, codigo = entrar(ana.email)

    assert codigo == 200
    assert navegador.get("/api/auth/quien-soy/").data["email"] == "ana@example.com"
    assert navegador.get("/api/pedidos/mios/").status_code == 200


# --- desactivar corta el acceso ---------------------------------------------------


def test_desactivar_cierra_la_sesion_que_ya_estaba_abierta(panel, ana):
    navegador, _ = entrar(ana.email)
    assert navegador.get("/api/auth/quien-soy/").status_code == 200

    assert cambiar_activo(panel, ana, False).status_code == 200

    # Misma cookie de sesion de antes, pero la cuenta ya no vale.
    assert navegador.get("/api/auth/quien-soy/").status_code == 403
    assert navegador.get("/api/pedidos/mios/").status_code == 403


def test_una_cuenta_desactivada_no_puede_volver_a_iniciar_sesion(panel, ana):
    cambiar_activo(panel, ana, False)

    navegador, codigo = entrar(ana.email)

    assert codigo == 400
    assert "sessionid" not in navegador.cookies
    assert navegador.get("/api/auth/quien-soy/").status_code == 403


def test_desactivar_a_alguien_del_personal_le_quita_el_panel(panel):
    otro = Usuario.objects.create_user(
        email="otro.staff@carneseus.test", password=CLAVE, is_staff=True
    )
    suyo, _ = entrar(otro.email)
    assert suyo.get("/api/pedidos/admin/").status_code == 200

    cambiar_activo(panel, otro, False)

    assert suyo.get("/api/pedidos/admin/").status_code == 403
    assert suyo.get("/api/auth/usuarios/").status_code == 403


def test_desactivar_una_cuenta_no_afecta_a_las_demas(panel, ana):
    luis = Usuario.objects.create_user(email="luis@example.com", password=CLAVE)
    navegador_luis, _ = entrar(luis.email)

    cambiar_activo(panel, ana, False)

    assert navegador_luis.get("/api/auth/quien-soy/").data["email"] == "luis@example.com"
    assert entrar(luis.email)[1] == 200


# --- reactivar devuelve el acceso -------------------------------------------------


def test_reactivar_permite_volver_a_entrar(panel, ana):
    cambiar_activo(panel, ana, False)
    assert entrar(ana.email)[1] == 400

    assert cambiar_activo(panel, ana, True).status_code == 200

    navegador, codigo = entrar(ana.email)
    assert codigo == 200
    assert navegador.get("/api/auth/quien-soy/").data["email"] == "ana@example.com"
    assert navegador.get("/api/pedidos/mios/").status_code == 200


# --- el personal no se puede dejar fuera a si mismo -----------------------------------


def test_el_personal_no_puede_desactivar_su_propia_cuenta(panel, staff):
    respuesta = cambiar_activo(panel, staff, False)

    assert respuesta.status_code == 400
    assert respuesta.data["is_active"] == ["No puedes desactivar tu propia cuenta."]
    staff.refresh_from_db()
    assert staff.is_active is True
    assert panel.get("/api/auth/usuarios/").status_code == 200


def test_un_cliente_no_puede_desactivar_otra_cuenta_con_su_sesion(ana):
    luis = Usuario.objects.create_user(email="luis@example.com", password=CLAVE)
    navegador, _ = entrar(ana.email)

    assert cambiar_activo(navegador, luis, False).status_code == 403
    assert entrar(luis.email)[1] == 200
