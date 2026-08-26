from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import Direccion
from apps.catalog.models import Categoria, Producto

Usuario = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def cliente(db):
    return Usuario.objects.create_user(
        email="cliente@test.co",
        password="clave-segura-123",
        nombre_completo="Cliente Test",
        telefono="3001112233",
    )


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(
        email="staff@test.co",
        password="clave-segura-123",
        nombre_completo="Staff Test",
        rol=Usuario.Rol.STAFF,
    )


@pytest.fixture
def direccion(cliente):
    return Direccion.objects.create(
        usuario=cliente,
        etiqueta="Casa",
        ciudad="Medellin",
        barrio="Laureles",
        direccion="Calle 33 #75-20",
        es_principal=True,
        en_zona_cobertura=True,
    )


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre="Lomo fino",
        slug="lomo-fino",
        categoria=categoria,
        precio=Decimal("52000.00"),
        unidad_medida=Producto.UnidadMedida.KILOGRAMO,
        stock=Decimal("10.000"),
        disponible=True,
    )


# Cada rol necesita su propio cliente HTTP. Si compartieran uno, pedir los
# dos en la misma prueba haria que la autenticacion del segundo pisara la del
# primero y la prueba mediria otra cosa.
@pytest.fixture
def api_cliente(cliente):
    api = APIClient()
    api.force_authenticate(user=cliente)
    return api


@pytest.fixture
def api_staff(staff):
    api = APIClient()
    api.force_authenticate(user=staff)
    return api
