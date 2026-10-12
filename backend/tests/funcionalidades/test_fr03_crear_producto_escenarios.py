"""FR-03 Crear producto: pruebas de escenarios (Gherkin en features/)."""

from decimal import Decimal

import pytest
from pytest_bdd import given, parsers, scenarios, then, when

from apps.catalog.models import Categoria

pytestmark = pytest.mark.django_db

scenarios("features/crear_producto.feature")


@given(parsers.parse('que existe la categoría "{nombre}"'), target_fixture="categorias")
def existe_la_categoria(nombre):
    categoria = Categoria.objects.create(nombre=nombre, slug=nombre.lower())
    return {nombre: categoria}


@when(
    parsers.parse('el administrador da de alta "{nombre}" en "{categoria}" a {precio:d} pesos'),
    target_fixture="respuesta",
)
def dar_de_alta(api, categorias, nombre, categoria, precio):
    return api.post(
        "/api/productos/",
        {
            "categoria": categorias[categoria].id,
            "nombre": nombre,
            "presentacion": "Bandeja 500 g",
            "precio": precio,
        },
        format="json",
    )


@then(parsers.parse("la API responde {codigo:d}"))
def la_api_responde(respuesta, codigo):
    assert respuesta.status_code == codigo, respuesta.data


@then(parsers.parse('el producto queda con el slug "{slug}"'))
def queda_con_el_slug(respuesta, slug):
    assert respuesta.data["slug"] == slug


@then(parsers.parse('"{nombre}" aparece en el catálogo a {precio:d} pesos'))
def aparece_en_el_catalogo(api, nombre, precio):
    catalogo = api.get("/api/productos/").data["results"]

    encontrados = [producto for producto in catalogo if producto["nombre"] == nombre]
    assert len(encontrados) == 1
    assert Decimal(encontrados[0]["precio"]) == precio
    assert encontrados[0]["disponible"] is True


@then(parsers.parse('el campo "{campo}" informa "{mensaje}"'))
def el_campo_informa(respuesta, campo, mensaje):
    assert mensaje in respuesta.data[campo]


@then("el catálogo sigue vacío")
def el_catalogo_sigue_vacio(api):
    assert api.get("/api/productos/").data["count"] == 0
