from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.promotions.models import Promocion


@pytest.fixture
def hoy():
    return timezone.localdate()


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def crear_producto(categoria):
    def _crear(nombre, precio="38900", archivado=False):
        slug = nombre.lower().replace(" ", "-")
        return Producto.objects.create(
            categoria=categoria,
            nombre=nombre,
            slug=slug,
            presentacion="Bandeja 500 g",
            precio=Decimal(precio),
            archivado=archivado,
        )

    return _crear


@pytest.fixture
def crear_promocion(hoy):
    def _crear(productos, porcentaje=20, inicio=None, fin=None, activa=True, nombre="Semana"):
        promocion = Promocion.objects.create(
            nombre=nombre,
            porcentaje=porcentaje,
            fecha_inicio=inicio or hoy,
            fecha_fin=fin or hoy + timedelta(days=7),
            activa=activa,
        )
        promocion.productos.set(productos)
        return promocion

    return _crear


@pytest.fixture
def staff(api, db):
    """Cliente con sesion de un usuario del personal."""
    usuario = Usuario.objects.create_user(
        email="admin@carneseus.test", password="ClaveDePrueba123", is_staff=True
    )
    api.force_authenticate(usuario)
    return api


@pytest.fixture
def datos(hoy, crear_producto):
    lomo = crear_producto("Lomo fino")

    def _datos(**sobrescribir):
        base = {
            "nombre": "Semana de la res",
            "porcentaje": 20,
            "fecha_inicio": hoy.isoformat(),
            "fecha_fin": (hoy + timedelta(days=7)).isoformat(),
            "activa": True,
            "productos": [lomo.id],
        }
        base.update(sobrescribir)
        return base

    return _datos


# --- Permisos ---------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("get", "/api/promociones/"),
        ("post", "/api/promociones/"),
        ("get", "/api/promociones/productos/"),
    ],
)
def test_sin_sesion_no_se_puede_entrar(api, metodo, ruta):
    assert getattr(api, metodo)(ruta, {}, format="json").status_code == 403


@pytest.mark.django_db
def test_un_cliente_sin_staff_no_puede_gestionar(api, crear_producto, crear_promocion):
    promocion = crear_promocion([crear_producto("Lomo fino")])
    cliente = Usuario.objects.create_user(email="ana@example.com", password="ClaveDePrueba123")
    api.force_authenticate(cliente)

    assert api.get("/api/promociones/").status_code == 403
    assert api.patch(f"/api/promociones/{promocion.id}/", {"porcentaje": 50}).status_code == 403
    assert api.delete(f"/api/promociones/{promocion.id}/").status_code == 403
    assert Promocion.objects.filter(pk=promocion.pk).exists()


# --- Alta, edicion y borrado ------------------------------------------------


@pytest.mark.django_db
def test_crea_la_promocion_con_sus_productos(staff, datos):
    respuesta = staff.post("/api/promociones/", datos(), format="json")

    assert respuesta.status_code == 201
    promocion = Promocion.objects.get(nombre="Semana de la res")
    assert promocion.porcentaje == 20
    assert [p.nombre for p in promocion.productos.all()] == ["Lomo fino"]
    assert respuesta.data["estado"] == "vigente"
    assert respuesta.data["productos_detalle"][0]["nombre"] == "Lomo fino"


@pytest.mark.django_db
@pytest.mark.parametrize("porcentaje", [0, 100, -5])
def test_rechaza_un_porcentaje_fuera_de_rango(staff, datos, porcentaje):
    respuesta = staff.post("/api/promociones/", datos(porcentaje=porcentaje), format="json")

    assert respuesta.status_code == 400
    assert "porcentaje" in respuesta.data


@pytest.mark.django_db
def test_rechaza_fechas_al_reves(staff, datos, hoy):
    respuesta = staff.post(
        "/api/promociones/",
        datos(fecha_inicio=hoy.isoformat(), fecha_fin=(hoy - timedelta(days=1)).isoformat()),
        format="json",
    )

    assert respuesta.status_code == 400
    assert "fecha_fin" in respuesta.data


@pytest.mark.django_db
def test_rechaza_una_promocion_sin_productos(staff, datos):
    respuesta = staff.post("/api/promociones/", datos(productos=[]), format="json")

    assert respuesta.status_code == 400
    assert respuesta.data["productos"] == ["Elige al menos un producto."]


@pytest.mark.django_db
def test_rechaza_un_producto_archivado(staff, datos, crear_producto):
    archivado = crear_producto("Osobuco", archivado=True)

    respuesta = staff.post("/api/promociones/", datos(productos=[archivado.id]), format="json")

    assert respuesta.status_code == 400
    assert "productos" in respuesta.data


@pytest.mark.django_db
def test_modifica_la_promocion(staff, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino")
    churrasco = crear_producto("Churrasco")
    promocion = crear_promocion([lomo])

    respuesta = staff.patch(
        f"/api/promociones/{promocion.id}/",
        {"porcentaje": 35, "productos": [lomo.id, churrasco.id]},
        format="json",
    )

    assert respuesta.status_code == 200
    promocion.refresh_from_db()
    assert promocion.porcentaje == 35
    assert promocion.productos.count() == 2


@pytest.mark.django_db
def test_un_patch_con_una_sola_fecha_se_compara_con_la_guardada(
    staff, crear_producto, crear_promocion, hoy
):
    promocion = crear_promocion([crear_producto("Lomo fino")], inicio=hoy)

    respuesta = staff.patch(
        f"/api/promociones/{promocion.id}/",
        {"fecha_fin": (hoy - timedelta(days=3)).isoformat()},
        format="json",
    )

    assert respuesta.status_code == 400
    assert "fecha_fin" in respuesta.data


@pytest.mark.django_db
def test_elimina_la_promocion(staff, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino")
    promocion = crear_promocion([lomo])

    respuesta = staff.delete(f"/api/promociones/{promocion.id}/")

    assert respuesta.status_code == 204
    assert not Promocion.objects.exists()
    assert Producto.objects.filter(pk=lomo.pk).exists()


@pytest.mark.django_db
def test_el_listado_trae_el_estado_de_cada_una(staff, crear_producto, crear_promocion, hoy):
    lomo = crear_producto("Lomo fino")
    crear_promocion(
        [lomo], nombre="Futura", inicio=hoy + timedelta(days=2), fin=hoy + timedelta(days=9)
    )
    crear_promocion(
        [lomo], nombre="Pasada", inicio=hoy - timedelta(days=9), fin=hoy - timedelta(days=2)
    )
    crear_promocion([lomo], nombre="Pausada", activa=False)
    crear_promocion([lomo], nombre="Actual")

    resultados = staff.get("/api/promociones/").data["results"]

    assert {r["nombre"]: r["estado"] for r in resultados} == {
        "Futura": "programada",
        "Pasada": "vencida",
        "Pausada": "inactiva",
        "Actual": "vigente",
    }


@pytest.mark.django_db
def test_el_selector_solo_ofrece_productos_visibles(staff, crear_producto):
    crear_producto("Lomo fino")
    crear_producto("Osobuco", archivado=True)

    respuesta = staff.get("/api/promociones/productos/")

    assert respuesta.status_code == 200
    assert [p["nombre"] for p in respuesta.data] == ["Lomo fino"]
    assert respuesta.data[0]["categoria"] == "Res"


# --- Precio en el catalogo --------------------------------------------------


def _en_catalogo(api, nombre):
    resultados = api.get("/api/productos/").data["results"]
    return next(p for p in resultados if p["nombre"] == nombre)


@pytest.mark.django_db
def test_el_catalogo_muestra_el_precio_rebajado(api, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino", precio="38900")
    crear_producto("Churrasco")
    crear_promocion([lomo], porcentaje=15)

    producto = _en_catalogo(api, "Lomo fino")

    assert producto["descuento"] == 15
    # 38900 * 0.85 = 33065
    assert producto["precio_promocion"] == "33065.00"
    assert producto["precio"] == "38900.00"
    otro = _en_catalogo(api, "Churrasco")
    assert otro["descuento"] is None
    assert otro["precio_promocion"] is None


@pytest.mark.django_db
def test_el_precio_rebajado_se_redondea_a_pesos(api, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino", precio="18950")
    crear_promocion([lomo], porcentaje=33)

    # 18950 * 0.67 = 12696.5, que sube a 12697
    assert _en_catalogo(api, "Lomo fino")["precio_promocion"] == "12697.00"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("desde", "hasta", "activa"),
    [
        (2, 9, True),  # programada
        (-9, -2, True),  # vencida
        (0, 7, False),  # pausada
    ],
)
def test_una_promocion_que_no_rige_no_cambia_el_precio(
    api, crear_producto, crear_promocion, hoy, desde, hasta, activa
):
    lomo = crear_producto("Lomo fino")
    crear_promocion(
        [lomo],
        inicio=hoy + timedelta(days=desde),
        fin=hoy + timedelta(days=hasta),
        activa=activa,
    )

    assert _en_catalogo(api, "Lomo fino")["descuento"] is None


@pytest.mark.django_db
def test_rige_el_mismo_dia_de_inicio_y_de_fin(api, crear_producto, crear_promocion, hoy):
    lomo = crear_producto("Lomo fino")
    crear_promocion([lomo], porcentaje=10, inicio=hoy, fin=hoy)

    assert _en_catalogo(api, "Lomo fino")["descuento"] == 10


@pytest.mark.django_db
def test_con_dos_promociones_vigentes_gana_la_mayor(api, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino")
    crear_promocion([lomo], porcentaje=10, nombre="Chica")
    crear_promocion([lomo], porcentaje=25, nombre="Grande")

    pagina = api.get("/api/productos/").data
    assert pagina["count"] == 1
    assert pagina["results"][0]["descuento"] == 25


@pytest.mark.django_db
def test_la_ficha_tambien_trae_el_descuento(api, crear_producto, crear_promocion):
    lomo = crear_producto("Lomo fino", precio="40000")
    crear_promocion([lomo], porcentaje=20)

    respuesta = api.get("/api/productos/lomo-fino/")

    assert respuesta.data["descuento"] == 20
    assert respuesta.data["precio_promocion"] == "32000.00"
