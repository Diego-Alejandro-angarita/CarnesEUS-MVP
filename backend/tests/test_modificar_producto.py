from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def otra_categoria(db):
    return Categoria.objects.create(nombre="Cerdo", slug="cerdo")


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        categoria=categoria,
        nombre="Lomo fino",
        slug="lomo-fino",
        descripcion="Corte magro y suave.",
        presentacion="Bandeja 500 g",
        precio=Decimal("38900"),
        foto_url="https://ejemplo.test/lomo-fino.jpg",
        disponible=True,
    )


@pytest.mark.django_db
def test_devuelve_el_producto_con_la_categoria_como_id(api, producto, categoria):
    respuesta = api.get(f"/api/productos/{producto.id}/")

    assert respuesta.status_code == 200
    assert respuesta.data["categoria"] == categoria.id
    assert respuesta.data["categoria_nombre"] == "Res"
    assert respuesta.data["nombre"] == "Lomo fino"


@pytest.mark.django_db
def test_un_producto_inexistente_responde_404(api, db):
    assert api.get("/api/productos/9999/").status_code == 404


@pytest.mark.django_db
def test_modifica_los_campos_enviados(api, producto):
    respuesta = api.patch(
        f"/api/productos/{producto.id}/",
        {"precio": "41500.00", "presentacion": "Bandeja 700 g"},
        format="json",
    )

    assert respuesta.status_code == 200
    producto.refresh_from_db()
    assert producto.precio == Decimal("41500.00")
    assert producto.presentacion == "Bandeja 700 g"
    assert producto.nombre == "Lomo fino"


@pytest.mark.django_db
def test_permite_cambiar_la_categoria(api, producto, otra_categoria):
    respuesta = api.patch(
        f"/api/productos/{producto.id}/", {"categoria": otra_categoria.id}, format="json"
    )

    assert respuesta.status_code == 200
    producto.refresh_from_db()
    assert producto.categoria == otra_categoria


@pytest.mark.django_db
def test_renombrar_no_cambia_el_slug(api, producto):
    api.patch(f"/api/productos/{producto.id}/", {"nombre": "Lomo fino madurado"}, format="json")

    producto.refresh_from_db()
    assert producto.nombre == "Lomo fino madurado"
    assert producto.slug == "lomo-fino"


@pytest.mark.django_db
def test_el_slug_se_puede_cambiar_a_proposito(api, producto):
    respuesta = api.patch(
        f"/api/productos/{producto.id}/", {"slug": "lomo-madurado"}, format="json"
    )

    assert respuesta.status_code == 200
    producto.refresh_from_db()
    assert producto.slug == "lomo-madurado"


@pytest.mark.django_db
def test_guardar_sin_tocar_el_slug_no_choca_consigo_mismo(api, producto, categoria):
    """Un PUT reenvia el slug actual: no debe leerse como duplicado."""
    respuesta = api.put(
        f"/api/productos/{producto.id}/",
        {
            "categoria": categoria.id,
            "nombre": "Lomo fino",
            "slug": "lomo-fino",
            "descripcion": "Corte magro y suave.",
            "presentacion": "Bandeja 500 g",
            "precio": "38900.00",
            "foto_url": "https://ejemplo.test/lomo-fino.jpg",
            "disponible": True,
        },
        format="json",
    )

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_rechaza_el_slug_de_otro_producto(api, producto, categoria):
    Producto.objects.create(
        categoria=categoria,
        nombre="Churrasco",
        slug="churrasco",
        presentacion="Bandeja 400 g",
        precio=Decimal("29900"),
    )

    respuesta = api.patch(f"/api/productos/{producto.id}/", {"slug": "churrasco"}, format="json")

    assert respuesta.status_code == 400
    assert "slug" in respuesta.data


@pytest.mark.django_db
@pytest.mark.parametrize("precio", ["-1000", "0"])
def test_rechaza_precios_no_positivos(api, producto, precio):
    respuesta = api.patch(f"/api/productos/{producto.id}/", {"precio": precio}, format="json")

    assert respuesta.status_code == 400
    assert "precio" in respuesta.data
    producto.refresh_from_db()
    assert producto.precio == Decimal("38900")


@pytest.mark.django_db
def test_permite_agotar_y_reponer_un_producto(api, producto):
    api.patch(f"/api/productos/{producto.id}/", {"disponible": False}, format="json")
    producto.refresh_from_db()
    assert producto.disponible is False

    api.patch(f"/api/productos/{producto.id}/", {"disponible": True}, format="json")
    producto.refresh_from_db()
    assert producto.disponible is True


@pytest.mark.django_db
def test_el_cambio_se_ve_en_el_catalogo(api, producto):
    api.patch(f"/api/productos/{producto.id}/", {"precio": "41500.00"}, format="json")

    resultado = api.get("/api/productos/").data["results"][0]

    assert Decimal(resultado["precio"]) == Decimal("41500.00")
