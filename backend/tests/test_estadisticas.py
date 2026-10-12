import json
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.estadisticas import ia
from apps.pedidos.models import ItemPedido, Pago, Pedido


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(
        email="staff@carneseus.test", password="UnaClaveSegura123", is_staff=True)


@pytest.fixture
def cliente(db):
    return Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")


@pytest.fixture
def lomo(db):
    res = Categoria.objects.create(nombre="Res", slug="res")
    return Producto.objects.create(categoria=res, nombre="Lomo fino", slug="lomo-fino",
                                   presentacion="Bandeja 500 g", precio=Decimal("40000"))


def crear_pedido(email, producto, cantidad=1, hace_dias=0,
                 estado=Pedido.Estado.PAGADO, acepta=False):
    total = producto.precio * cantidad
    pedido = Pedido.objects.create(
        nombre=email.split("@")[0], email=email, telefono="3000000000",
        direccion="Cra 1 # 2-3", municipio="Medellin", barrio="Laureles",
        estado=estado, total=total, acepta_comunicaciones=acepta)
    ItemPedido.objects.create(pedido=pedido, producto=producto, nombre=producto.nombre,
                              precio_unitario=producto.precio, cantidad=cantidad)
    Pago.objects.create(pedido=pedido, metodo=Pago.Metodo.TRANSFERENCIA, monto=total)
    Pedido.objects.filter(pk=pedido.pk).update(
        creado_en=timezone.now() - timedelta(days=hace_dias))
    return pedido


@pytest.mark.django_db
@pytest.mark.parametrize("ruta", ["resumen", "productos", "clientes"])
def test_un_cliente_no_ve_estadisticas(api, cliente, ruta):
    api.force_authenticate(cliente)
    assert api.get(f"/api/estadisticas/{ruta}/").status_code == 403


@pytest.mark.django_db
def test_resumen_suma_solo_los_pedidos_pagados(api, staff, lomo):
    crear_pedido("ana@example.com", lomo, cantidad=2)          # 80.000
    crear_pedido("luis@example.com", lomo)                     # 40.000
    crear_pedido("x@example.com", lomo, estado=Pedido.Estado.POR_CONFIRMAR)
    api.force_authenticate(staff)
    datos = api.get("/api/estadisticas/resumen/").json()
    assert Decimal(str(datos["total_vendido"])) == Decimal("120000")
    assert datos["numero_pedidos"] == 2
    assert datos["clientes_unicos"] == 2


@pytest.mark.django_db
def test_resumen_sin_ventas_no_divide_por_cero(api, staff):
    api.force_authenticate(staff)
    assert api.get("/api/estadisticas/resumen/").json()["ticket_promedio"] == 0


@pytest.mark.django_db
def test_clientes_quedan_segmentados(api, staff, lomo):
    crear_pedido("nueva@example.com", lomo, hace_dias=2)
    crear_pedido("fiel@example.com", lomo, hace_dias=20)
    crear_pedido("fiel@example.com", lomo, hace_dias=1, acepta=True)
    crear_pedido("perdido@example.com", lomo, hace_dias=45)
    api.force_authenticate(staff)
    datos = api.get("/api/estadisticas/clientes/").json()
    assert datos["segmentos"] == {"nuevo": 1, "recurrente": 1, "inactivo": 1}


@pytest.mark.django_db
def test_resumen_respeta_el_rango_por_defecto(api, staff, lomo):
    """Por defecto (ultimos 30 dias) un pedido viejo no debe aparecer."""
    crear_pedido("hoy@example.com", lomo, hace_dias=0)
    crear_pedido("viejo@example.com", lomo, hace_dias=60)
    api.force_authenticate(staff)
    datos = api.get("/api/estadisticas/resumen/").json()
    assert datos["numero_pedidos"] == 1


@pytest.mark.django_db
def test_rango_invertido_devuelve_400(api, staff):
    api.force_authenticate(staff)
    respuesta = api.get("/api/estadisticas/resumen/?desde=2026-10-10&hasta=2026-10-01")
    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_sin_llave_usa_reglas_y_solo_cuenta_autorizados(api, staff, lomo, settings):
    settings.IA_API_KEY = ""
    crear_pedido("si@example.com", lomo, acepta=True)
    crear_pedido("no@example.com", lomo, acepta=False)
    api.force_authenticate(staff)
    datos = api.post("/api/estadisticas/sugerencias/").json()
    nuevos = next(c for c in datos["campanas"] if c["segmento"] == "nuevo")
    assert datos["origen"] == "reglas"
    assert nuevos["destinatarios"] == 1


@pytest.mark.django_db
def test_con_llave_usa_la_ia(api, staff, lomo, settings, monkeypatch):
    settings.IA_API_KEY = "llave-de-prueba"
    monkeypatch.setattr(ia, "sugerencias_con_ia", lambda ctx: {
        "sugerencias": ["Haz un combo"],
        "campanas": [{"segmento": "nuevo", "mensaje": "Hola"}],
    })
    api.force_authenticate(staff)
    datos = api.post("/api/estadisticas/sugerencias/").json()
    assert datos["origen"] == "ia"
    assert datos["sugerencias"] == ["Haz un combo"]


@pytest.mark.django_db
def test_si_la_ia_falla_cae_a_reglas(api, staff, settings, monkeypatch):
    settings.IA_API_KEY = "llave-de-prueba"
    def explota(ctx):
        raise RuntimeError("sin red")
    monkeypatch.setattr(ia, "sugerencias_con_ia", explota)
    api.force_authenticate(staff)
    assert api.post("/api/estadisticas/sugerencias/").json()["origen"] == "reglas"


@pytest.mark.django_db
def test_al_modelo_no_le_llegan_datos_personales(lomo):
    crear_pedido("secreto@example.com", lomo, acepta=True)
    hoy = timezone.localdate()
    assert "secreto@example.com" not in json.dumps(ia.contexto(hoy, hoy))
