from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def crear_producto(categoria):
    def _crear(nombre="Lomo fino", slug=None):
        return Producto.objects.create(
            categoria=categoria,
            nombre=nombre,
            slug=slug or nombre.lower().replace(" ", "-"),
            descripcion="Corte de prueba.",
            presentacion="Bandeja 500 g",
            precio=Decimal("38900"),
            disponible=True,
        )

    return _crear


@pytest.mark.django_db
def test_eliminar_responde_204(api, crear_producto):
    producto = crear_producto()

    assert api.delete(f"/api/productos/{producto.id}/").status_code == 204


@pytest.mark.django_db
def test_la_ficha_se_conserva_archivada(api, crear_producto):
    producto = crear_producto()

    api.delete(f"/api/productos/{producto.id}/")

    producto.refresh_from_db()
    assert producto.archivado is True
    assert producto.nombre == "Lomo fino"


@pytest.mark.django_db
def test_desaparece_del_catalogo(api, crear_producto):
    crear_producto("Churrasco")
    producto = crear_producto("Lomo fino")

    api.delete(f"/api/productos/{producto.id}/")

    respuesta = api.get("/api/productos/")
    assert respuesta.data["count"] == 1
    assert [item["nombre"] for item in respuesta.data["results"]] == ["Churrasco"]


@pytest.mark.django_db
def test_un_producto_archivado_ya_no_se_consulta(api, crear_producto):
    producto = crear_producto()
    api.delete(f"/api/productos/{producto.id}/")

    assert api.get(f"/api/productos/{producto.id}/").status_code == 404


@pytest.mark.django_db
def test_un_producto_archivado_ya_no_se_modifica(api, crear_producto):
    producto = crear_producto()
    api.delete(f"/api/productos/{producto.id}/")

    respuesta = api.patch(f"/api/productos/{producto.id}/", {"precio": "1000"}, format="json")

    assert respuesta.status_code == 404
    producto.refresh_from_db()
    assert producto.precio == Decimal("38900")


@pytest.mark.django_db
def test_eliminar_dos_veces_responde_404(api, crear_producto):
    producto = crear_producto()
    api.delete(f"/api/productos/{producto.id}/")

    assert api.delete(f"/api/productos/{producto.id}/").status_code == 404


@pytest.mark.django_db
def test_eliminar_un_id_inexistente_responde_404(api, db):
    assert api.delete("/api/productos/9999/").status_code == 404


@pytest.mark.django_db
def test_desarchivar_devuelve_el_producto_al_catalogo(api, crear_producto):
    """El admin de Django es la via de vuelta: quitar la marca lo republica."""
    producto = crear_producto()
    api.delete(f"/api/productos/{producto.id}/")

    Producto.objects.filter(pk=producto.pk).update(archivado=False)

    assert api.get("/api/productos/").data["count"] == 1


@pytest.mark.django_db
def test_el_slug_archivado_sigue_ocupado(api, crear_producto, categoria):
    """La fila sigue existiendo, asi que un alta con el mismo nombre no choca."""
    producto = crear_producto()
    api.delete(f"/api/productos/{producto.id}/")

    respuesta = api.post(
        "/api/productos/",
        {
            "categoria": categoria.id,
            "nombre": "Lomo fino",
            "presentacion": "Bandeja 500 g",
            "precio": "40000",
        },
        format="json",
    )

    assert respuesta.status_code == 201
    assert respuesta.data["slug"] == "lomo-fino-2"
