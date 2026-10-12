"""
Pruebas automaticas por funcionalidad: un happy path y un flujo alternativo
para cada requisito entregado. El tipo de prueba va en el nombre del archivo.
"""

from decimal import Decimal

import pytest

from apps.catalog.models import Categoria, Producto


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def crear_producto(categoria):
    def _crear(nombre, precio="38900", disponible=True):
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
