from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def crear_producto(categoria):
    def _crear(nombre, disponible=True):
        slug = nombre.lower().replace(" ", "-")
        return Producto.objects.create(
            categoria=categoria,
            nombre=nombre,
            slug=slug,
            descripcion="Corte de prueba.",
            presentacion="Bandeja 500 g",
            precio=Decimal("38900"),
            foto_url=f"https://ejemplo.test/{slug}.jpg",
            disponible=disponible,
        )

    return _crear


@pytest.mark.django_db
def test_agotar_un_producto(api, crear_producto):
    producto = crear_producto("Lomo fino")

    respuesta = api.patch(
        f"/api/productos/{producto.id}/", {"disponible": False}, format="json"
    )

    assert respuesta.status_code == 200
    assert respuesta.data["disponible"] is False
    producto.refresh_from_db()
    assert producto.disponible is False


@pytest.mark.django_db
def test_reponer_un_producto(api, crear_producto):
    producto = crear_producto("Lomo fino", disponible=False)

    respuesta = api.patch(f"/api/productos/{producto.id}/", {"disponible": True}, format="json")

    assert respuesta.status_code == 200
    producto.refresh_from_db()
    assert producto.disponible is True


@pytest.mark.django_db
def test_el_cambio_no_toca_ningun_otro_dato(api, crear_producto):
    producto = crear_producto("Lomo fino")

    api.patch(f"/api/productos/{producto.id}/", {"disponible": False}, format="json")

    producto.refresh_from_db()
    assert producto.nombre == "Lomo fino"
    assert producto.slug == "lomo-fino"
    assert producto.precio == Decimal("38900")
    assert producto.presentacion == "Bandeja 500 g"
    assert producto.foto_url == "https://ejemplo.test/lomo-fino.jpg"


@pytest.mark.django_db
def test_agotar_manda_el_producto_al_final_del_catalogo(api, crear_producto):
    """El catalogo ordena por -disponible: los agotados se ven, pero al final."""
    lomo = crear_producto("Aguja")
    crear_producto("Bife")

    assert [p["nombre"] for p in api.get("/api/productos/").data["results"]] == ["Aguja", "Bife"]

    api.patch(f"/api/productos/{lomo.id}/", {"disponible": False}, format="json")

    resultados = api.get("/api/productos/").data["results"]
    assert [p["nombre"] for p in resultados] == ["Bife", "Aguja"]
    assert resultados[1]["disponible"] is False


@pytest.mark.django_db
def test_un_producto_agotado_sigue_en_el_catalogo(api, crear_producto):
    """Agotar no es eliminar: el producto se sigue viendo, marcado."""
    producto = crear_producto("Lomo fino")

    api.patch(f"/api/productos/{producto.id}/", {"disponible": False}, format="json")

    assert api.get("/api/productos/").data["count"] == 1


@pytest.mark.django_db
def test_no_se_puede_cambiar_la_disponibilidad_de_un_archivado(api, crear_producto):
    producto = crear_producto("Lomo fino")
    api.delete(f"/api/productos/{producto.id}/")

    respuesta = api.patch(
        f"/api/productos/{producto.id}/", {"disponible": False}, format="json"
    )

    assert respuesta.status_code == 404
