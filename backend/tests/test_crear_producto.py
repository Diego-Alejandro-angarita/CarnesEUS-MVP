from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def datos(categoria):
    def _datos(**sobrescribir):
        base = {
            "categoria": categoria.id,
            "nombre": "Lomo fino",
            "descripcion": "Corte magro y suave.",
            "presentacion": "Bandeja 500 g",
            "precio": "38900.00",
            "foto_url": "https://ejemplo.test/lomo-fino.jpg",
            "disponible": True,
        }
        base.update(sobrescribir)
        return base

    return _datos


@pytest.mark.django_db
def test_crea_el_producto_con_datos_validos(api, datos):
    respuesta = api.post("/api/productos/", datos(), format="json")

    assert respuesta.status_code == 201
    producto = Producto.objects.get(nombre="Lomo fino")
    assert producto.precio == Decimal("38900.00")
    assert producto.presentacion == "Bandeja 500 g"
    assert producto.disponible is True
    assert respuesta.data["categoria_nombre"] == "Res"


@pytest.mark.django_db
def test_el_slug_se_genera_a_partir_del_nombre(api, datos):
    respuesta = api.post("/api/productos/", datos(nombre="Punta de anca"), format="json")

    assert respuesta.data["slug"] == "punta-de-anca"


@pytest.mark.django_db
def test_un_nombre_repetido_no_choca_de_slug(api, datos):
    api.post("/api/productos/", datos(), format="json")

    respuesta = api.post("/api/productos/", datos(), format="json")

    assert respuesta.status_code == 201
    assert respuesta.data["slug"] == "lomo-fino-2"
    assert Producto.objects.count() == 2


@pytest.mark.django_db
def test_respeta_el_slug_enviado_y_rechaza_el_repetido(api, datos):
    api.post("/api/productos/", datos(slug="corte-estrella"), format="json")

    repetido = api.post(
        "/api/productos/", datos(nombre="Otro", slug="corte-estrella"), format="json"
    )

    assert repetido.status_code == 400
    assert "slug" in repetido.data


@pytest.mark.django_db
@pytest.mark.parametrize("precio", ["-1000", "0"])
def test_rechaza_precios_no_positivos(api, datos, precio):
    respuesta = api.post("/api/productos/", datos(precio=precio), format="json")

    assert respuesta.status_code == 400
    assert "precio" in respuesta.data
    assert not Producto.objects.exists()


@pytest.mark.django_db
def test_rechaza_una_categoria_inexistente(api, datos):
    respuesta = api.post("/api/productos/", datos(categoria=9999), format="json")

    assert respuesta.status_code == 400
    assert "categoria" in respuesta.data


@pytest.mark.django_db
def test_indica_los_campos_obligatorios_que_faltan(api, categoria):
    respuesta = api.post("/api/productos/", {}, format="json")

    assert respuesta.status_code == 400
    assert {"categoria", "nombre", "presentacion", "precio"} <= set(respuesta.data)


@pytest.mark.django_db
def test_el_producto_creado_aparece_en_el_catalogo(api, datos):
    api.post("/api/productos/", datos(), format="json")

    resultados = api.get("/api/productos/").data["results"]

    assert [producto["nombre"] for producto in resultados] == ["Lomo fino"]
    assert resultados[0]["categoria"] == "Res"


@pytest.mark.django_db
def test_las_categorias_se_listan_sin_paginar(api, categoria):
    Categoria.objects.create(nombre="Cerdo", slug="cerdo")

    respuesta = api.get("/api/categorias/")

    assert respuesta.status_code == 200
    assert [item["nombre"] for item in respuesta.data] == ["Cerdo", "Res"]
