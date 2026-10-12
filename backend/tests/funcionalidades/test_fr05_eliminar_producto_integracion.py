"""
FR-05 Eliminar producto: pruebas de integracion.

Eliminar archiva el producto, y eso tiene que notarse en todos los componentes
que lo consultan: la administracion, el catalogo publico, la ficha y el
selector de las promociones.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.catalog.models import Producto
from apps.promotions.models import Promocion


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(
        email="admin@carneseus.test", password="ClaveDePrueba123", is_staff=True
    )


def nombres(respuesta):
    filas = respuesta.data["results"] if "results" in respuesta.data else respuesta.data
    return {fila["nombre"] for fila in filas}


@pytest.mark.django_db
def test_eliminar_saca_el_producto_de_todos_los_componentes(api, crear_producto, staff):
    lomo = crear_producto("Lomo fino")
    crear_producto("Punta de anca")
    hoy = timezone.localdate()
    promocion = Promocion.objects.create(
        nombre="Semana de la res", porcentaje=20, fecha_inicio=hoy, fecha_fin=hoy + timedelta(7)
    )
    promocion.productos.set([lomo])

    respuesta = api.delete(f"/api/productos/{lomo.id}/")

    assert respuesta.status_code == 204
    # Administracion: ya no se consulta ni se modifica.
    assert api.get(f"/api/productos/{lomo.id}/").status_code == 404
    assert api.patch(f"/api/productos/{lomo.id}/", {"precio": "1"}).status_code == 404
    # Catalogo publico: desaparece del listado y de la busqueda.
    assert nombres(api.get("/api/productos/")) == {"Punta de anca"}
    assert api.get("/api/productos/?search=lomo").data["count"] == 0
    # Ficha: los enlaces que ya circulan siguen respondiendo.
    assert api.get("/api/productos/lomo-fino/").status_code == 200
    # Promociones: no se ofrece para armar una nueva.
    api.force_authenticate(staff)
    assert nombres(api.get("/api/promociones/productos/")) == {"Punta de anca"}
    # Base de datos: la fila se conserva, archivada.
    lomo.refresh_from_db()
    assert lomo.archivado is True


@pytest.mark.django_db
def test_eliminar_un_producto_que_no_existe_no_altera_nada(api, crear_producto):
    lomo = crear_producto("Lomo fino")
    api.delete(f"/api/productos/{lomo.id}/")
    crear_producto("Punta de anca")

    inexistente = api.delete(f"/api/productos/{lomo.id + 1000}/")
    otra_vez = api.delete(f"/api/productos/{lomo.id}/")

    assert inexistente.status_code == 404
    assert otra_vez.status_code == 404
    assert nombres(api.get("/api/productos/")) == {"Punta de anca"}
    assert Producto.objects.filter(archivado=False).count() == 1
