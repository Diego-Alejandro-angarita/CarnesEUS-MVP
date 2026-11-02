"""FR-00 Catalogo de productos: pruebas de rendimiento."""

import time
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.catalog.models import Producto
from apps.promotions.models import Promocion

# Presupuesto para que la API sirva una pagina del catalogo. La wiki pide
# paginas por debajo de 2 segundos completas; la API se lleva solo una parte.
PRESUPUESTO_SEGUNDOS = 0.5


def poblar(categoria, cantidad):
    """Catalogo de `cantidad` productos, la mitad de ellos en promocion."""
    productos = Producto.objects.bulk_create(
        Producto(
            categoria=categoria,
            nombre=f"Corte {indice:04d}",
            slug=f"corte-{indice:04d}",
            presentacion="Bandeja 500 g",
            precio=Decimal("20000") + indice,
            disponible=indice % 7 != 0,
        )
        for indice in range(cantidad)
    )
    hoy = timezone.localdate()
    promocion = Promocion.objects.create(
        nombre="Semana de la res",
        porcentaje=15,
        fecha_inicio=hoy,
        fecha_fin=hoy + timedelta(days=7),
    )
    promocion.productos.set(productos[::2])


def medir(api, ruta):
    """Hace la peticion y devuelve la respuesta, las consultas y el tiempo."""
    with CaptureQueriesContext(connection) as consultas:
        inicio = time.perf_counter()
        respuesta = api.get(ruta)
        duracion = time.perf_counter() - inicio
    return respuesta, len(consultas), duracion


@pytest.mark.django_db
def test_la_pagina_del_catalogo_no_se_vuelve_mas_lenta_al_crecer(api, categoria):
    poblar(categoria, 5)
    api.get("/api/productos/")  # calentamiento: carga de URLs y serializers
    _, consultas_con_pocos, _ = medir(api, "/api/productos/")

    Producto.objects.bulk_create(
        Producto(
            categoria=categoria,
            nombre=f"Extra {indice:04d}",
            slug=f"extra-{indice:04d}",
            presentacion="Bandeja 500 g",
            precio=Decimal("30000"),
        )
        for indice in range(495)
    )
    respuesta, consultas_con_muchos, duracion = medir(api, "/api/productos/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 500
    assert len(respuesta.data["results"]) == 20
    # Sin N+1: categoria y descuento llegan en la misma consulta del listado.
    assert consultas_con_muchos == consultas_con_pocos <= 2
    assert duracion < PRESUPUESTO_SEGUNDOS


@pytest.mark.django_db
def test_un_page_size_desmedido_se_recorta_y_no_dispara_el_costo(api, categoria):
    poblar(categoria, 500)
    api.get("/api/productos/")

    respuesta, consultas, duracion = medir(api, "/api/productos/?page_size=100000")

    assert respuesta.status_code == 200
    # El maximo de PaginacionEstandar: nadie puede pedir el catalogo entero.
    assert len(respuesta.data["results"]) == 100
    assert respuesta.data["next"] is not None
    assert consultas <= 2
    assert duracion < PRESUPUESTO_SEGUNDOS
