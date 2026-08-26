from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.catalog.models import Producto, Promocion

pytestmark = pytest.mark.django_db


def test_el_catalogo_es_publico(api, producto):
    respuesta = api.get("/api/productos/")
    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 1


def test_el_cliente_no_ve_productos_dados_de_baja(api, producto, categoria):
    Producto.objects.create(
        nombre="Corte agotado",
        slug="corte-agotado",
        categoria=categoria,
        precio=Decimal("10000"),
        stock=Decimal("0"),
        disponible=False,
    )
    nombres = [p["nombre"] for p in api.get("/api/productos/").data["results"]]
    assert nombres == ["Lomo fino"]


def test_el_staff_si_ve_los_no_disponibles(api_staff, producto, categoria):
    Producto.objects.create(
        nombre="Corte agotado",
        slug="corte-agotado",
        categoria=categoria,
        precio=Decimal("10000"),
        stock=Decimal("0"),
        disponible=False,
    )
    assert api_staff.get("/api/productos/").data["count"] == 2


def test_busqueda_por_nombre(api, producto):
    assert api.get("/api/productos/?search=lomo").data["count"] == 1
    assert api.get("/api/productos/?search=pescado").data["count"] == 0


def test_filtros_de_categoria_y_precio(api, producto):
    assert api.get("/api/productos/?categoria=res").data["count"] == 1
    assert api.get("/api/productos/?precio_max=1000").data["count"] == 0
    assert api.get("/api/productos/?precio_min=1000").data["count"] == 1


def test_ficha_de_producto_por_slug(api, producto):
    respuesta = api.get(f"/api/productos/{producto.slug}/")
    assert respuesta.status_code == 200
    assert respuesta.data["categoria_nombre"] == "Res"
    assert respuesta.data["hay_existencias"] is True


def test_un_cliente_no_puede_crear_productos(api_cliente, categoria):
    respuesta = api_cliente.post(
        "/api/productos/",
        {
            "nombre": "Pirata",
            "slug": "pirata",
            "categoria": categoria.id,
            "precio": "1000.00",
            "stock": "1.000",
        },
        format="json",
    )
    assert respuesta.status_code == 403


def test_el_staff_administra_el_catalogo(api_staff, categoria):
    """FR-03/04/05."""
    crear = api_staff.post(
        "/api/productos/",
        {
            "nombre": "Costilla",
            "slug": "costilla",
            "categoria": categoria.id,
            "precio": "26000.00",
            "unidad_medida": "KG",
            "stock": "15.000",
        },
        format="json",
    )
    assert crear.status_code == 201

    editar = api_staff.patch(
        "/api/productos/costilla/", {"precio": "27000.00"}, format="json"
    )
    assert editar.status_code == 200
    assert editar.data["precio"] == "27000.00"

    assert api_staff.delete("/api/productos/costilla/").status_code == 204


def test_cambiar_disponibilidad(api_staff, producto):
    """FR-09."""
    respuesta = api_staff.patch(
        f"/api/productos/{producto.slug}/disponibilidad/",
        {"disponible": False},
        format="json",
    )
    assert respuesta.status_code == 200
    producto.refresh_from_db()
    assert producto.disponible is False


def _crear_promocion(tipo, valor, dias_inicio, dias_fin):
    ahora = timezone.now()
    return Promocion.objects.create(
        nombre="Promo de prueba",
        tipo=tipo,
        valor=Decimal(valor),
        inicia_en=ahora + timedelta(days=dias_inicio),
        termina_en=ahora + timedelta(days=dias_fin),
    )


def test_promocion_calcula_descuento(db):
    promo = _crear_promocion(Promocion.Tipo.PORCENTAJE, "10", -1, 1)
    assert promo.vigente is True
    assert promo.descuento_sobre(Decimal("52000")) == Decimal("5200")


def test_promocion_vencida_no_descuenta(db):
    promo = _crear_promocion(Promocion.Tipo.MONTO_FIJO, "5000", -10, -5)
    assert promo.vigente is False
    assert promo.descuento_sobre(Decimal("52000")) == Decimal("0")


def test_el_descuento_nunca_deja_el_precio_en_negativo(db):
    promo = _crear_promocion(Promocion.Tipo.MONTO_FIJO, "999999", -1, 1)
    assert promo.descuento_sobre(Decimal("52000")) == Decimal("52000")
