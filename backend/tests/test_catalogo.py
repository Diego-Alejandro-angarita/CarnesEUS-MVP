from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def crear_producto(categoria):
    def _crear(nombre, disponible=True, precio="20000"):
        slug = nombre.lower().replace(" ", "-")
        return Producto.objects.create(
            categoria=categoria,
            nombre=nombre,
            slug=slug,
            descripcion="Corte de prueba.",
            presentacion="Bandeja 500 g",
            precio=Decimal(precio),
            foto_url=f"https://ejemplo.test/{slug}.jpg",
            disponible=disponible,
        )

    return _crear


@pytest.mark.django_db
def test_listado_es_publico(api, crear_producto):
    crear_producto("Lomo fino")

    respuesta = api.get("/api/productos/")

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_respuesta_viene_paginada(api, crear_producto):
    for indice in range(3):
        crear_producto(f"Corte {indice}")

    respuesta = api.get("/api/productos/")

    assert set(respuesta.data) >= {"count", "next", "previous", "results"}
    assert respuesta.data["count"] == 3
    assert len(respuesta.data["results"]) == 3


@pytest.mark.django_db
def test_producto_expone_foto_precio_y_disponibilidad(api, crear_producto):
    crear_producto("Punta de anca", precio="34500")

    producto = api.get("/api/productos/").data["results"][0]

    assert producto["foto_url"] == "https://ejemplo.test/punta-de-anca.jpg"
    assert Decimal(producto["precio"]) == Decimal("34500")
    assert producto["disponible"] is True
    assert producto["categoria"] == "Res"


@pytest.mark.django_db
def test_page_size_y_page_recorren_el_catalogo(api, crear_producto):
    for indice in range(5):
        crear_producto(f"Corte {indice}")

    primera = api.get("/api/productos/", {"page_size": 2})
    segunda = api.get("/api/productos/", {"page_size": 2, "page": 2})

    assert len(primera.data["results"]) == 2
    assert primera.data["previous"] is None
    assert primera.data["next"] is not None
    assert len(segunda.data["results"]) == 2
    assert segunda.data["previous"] is not None
    ids_primera = {producto["id"] for producto in primera.data["results"]}
    ids_segunda = {producto["id"] for producto in segunda.data["results"]}
    assert ids_primera.isdisjoint(ids_segunda)


@pytest.mark.django_db
def test_los_agotados_se_listan_al_final_sin_ocultarse(api, crear_producto):
    crear_producto("Agotado", disponible=False)
    crear_producto("Disponible")

    resultados = api.get("/api/productos/").data["results"]

    assert [producto["nombre"] for producto in resultados] == ["Disponible", "Agotado"]
    assert resultados[1]["disponible"] is False


@pytest.mark.django_db
def test_buscar_por_nombre_devuelve_las_coincidencias(api, crear_producto):
    crear_producto("Lomo fino")
    crear_producto("Punta de anca")

    respuesta = api.get("/api/productos/", {"search": "lomo"})

    assert respuesta.data["count"] == 1
    assert respuesta.data["results"][0]["nombre"] == "Lomo fino"


@pytest.mark.django_db
def test_buscar_por_nombre_no_distingue_mayusculas(api, crear_producto):
    crear_producto("Lomo fino")

    respuesta = api.get("/api/productos/", {"search": "LOMO"})

    assert respuesta.data["count"] == 1


@pytest.mark.django_db
def test_buscar_sin_coincidencias_devuelve_lista_vacia(api, crear_producto):
    crear_producto("Lomo fino")

    respuesta = api.get("/api/productos/", {"search": "chorizo"})

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 0
    assert respuesta.data["results"] == []


@pytest.mark.django_db
def test_catalogo_vacio_responde_lista_vacia(api):
    respuesta = api.get("/api/productos/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 0
    assert respuesta.data["results"] == []


@pytest.mark.django_db
def test_ficha_de_producto_devuelve_el_detalle_completo(api, crear_producto):
    crear_producto("Lomo fino", precio="38900")

    respuesta = api.get("/api/productos/lomo-fino/")

    assert respuesta.status_code == 200
    assert respuesta.data["nombre"] == "Lomo fino"
    assert respuesta.data["descripcion"] == "Corte de prueba."
    assert respuesta.data["presentacion"] == "Bandeja 500 g"
    assert Decimal(respuesta.data["precio"]) == Decimal("38900")
    assert respuesta.data["categoria"] == "Res"


@pytest.mark.django_db
def test_ficha_de_producto_agotado_tambien_se_puede_ver(api, crear_producto):
    crear_producto("Agotado", disponible=False)

    respuesta = api.get("/api/productos/agotado/")

    assert respuesta.status_code == 200
    assert respuesta.data["disponible"] is False


@pytest.mark.django_db
def test_ficha_de_producto_inexistente_responde_404(api):
    respuesta = api.get("/api/productos/no-existe/")

    assert respuesta.status_code == 404
