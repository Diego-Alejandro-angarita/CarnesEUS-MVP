from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.pedidos.models import ItemPedido, Pago, Pedido


@pytest.fixture
def cliente(db):
    return Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(
        email="staff@carneseus.test", password="UnaClaveSegura123", is_staff=True
    )


@pytest.fixture
def producto(db):
    categoria = Categoria.objects.create(nombre="Res", slug="res")
    return Producto.objects.create(
        categoria=categoria,
        nombre="Lomo fino",
        slug="lomo-fino",
        presentacion="Bandeja 500 g",
        precio=Decimal("38900.00"),
    )


def crear_pedido(producto, usuario=None, email="ana@example.com"):
    pedido = Pedido.objects.create(
        usuario=usuario,
        nombre="Ana Gomez",
        email=email,
        telefono="3001234567",
        direccion="Cra 70 # 45-10",
        municipio="Medellin",
        barrio="Laureles",
        estado=Pedido.Estado.POR_CONFIRMAR,
        total=producto.precio,
    )
    ItemPedido.objects.create(
        pedido=pedido,
        producto=producto,
        nombre=producto.nombre,
        precio_unitario=producto.precio,
        cantidad=1,
    )
    Pago.objects.create(pedido=pedido, metodo=Pago.Metodo.TRANSFERENCIA, monto=producto.precio)
    return pedido


@pytest.fixture
def pedido(producto):
    return crear_pedido(producto)


def cambiar_etapa(api, pedido_id, etapa):
    return api.post(
        f"/api/pedidos/admin/{pedido_id}/cambiar-etapa/", {"etapa": etapa}, format="json"
    )


# --- reglas de las etapas (modelo) ----------------------------------------------


@pytest.mark.django_db
def test_un_pedido_nuevo_nace_recibido(api, producto):
    token = api.post(
        "/api/carrito/items/", {"producto": producto.id, "cantidad": 1}, format="json"
    ).data["token"]

    respuesta = api.post(
        "/api/pedidos/",
        {
            "metodo_pago": "contraentrega_qr",
            "nombre": "Ana Gomez",
            "email": "ana@example.com",
            "telefono": "3001234567",
            "direccion": "Cra 70 # 45-10",
            "municipio": "Medellin",
            "barrio": "Laureles",
        },
        format="json",
        HTTP_X_CARRITO_TOKEN=token,
    )

    assert respuesta.status_code == 201
    assert respuesta.data["etapa"] == "recibido"
    assert respuesta.data["etapas_siguientes"] == ["en_preparacion", "cancelado"]
    assert [paso["etapa"] for paso in respuesta.data["seguimiento"]] == ["recibido"]


@pytest.mark.django_db
def test_se_avanza_paso_a_paso_hasta_entregado(pedido):
    for etapa in ("en_preparacion", "en_camino", "entregado"):
        pedido.cambiar_etapa(etapa)

    pedido.refresh_from_db()
    assert pedido.etapa == Pedido.Etapa.ENTREGADO
    assert list(pedido.historial.values_list("etapa", flat=True)) == [
        "en_preparacion",
        "en_camino",
        "entregado",
    ]


@pytest.mark.django_db
def test_no_se_puede_saltar_un_paso(pedido):
    with pytest.raises(ValidationError):
        pedido.cambiar_etapa(Pedido.Etapa.EN_CAMINO)

    pedido.refresh_from_db()
    assert pedido.etapa == Pedido.Etapa.RECIBIDO
    assert not pedido.historial.exists()


@pytest.mark.django_db
def test_no_se_puede_retroceder(pedido):
    pedido.cambiar_etapa(Pedido.Etapa.EN_PREPARACION)

    with pytest.raises(ValidationError):
        pedido.cambiar_etapa(Pedido.Etapa.RECIBIDO)


@pytest.mark.django_db
@pytest.mark.parametrize("pasos_previos", [[], ["en_preparacion"]])
def test_se_puede_cancelar_antes_de_salir_a_entrega(pedido, pasos_previos):
    for etapa in pasos_previos:
        pedido.cambiar_etapa(etapa)

    pedido.cambiar_etapa(Pedido.Etapa.CANCELADO)

    pedido.refresh_from_db()
    assert pedido.etapa == Pedido.Etapa.CANCELADO


@pytest.mark.django_db
@pytest.mark.parametrize(
    "pasos_previos",
    [["en_preparacion", "en_camino"], ["en_preparacion", "en_camino", "entregado"]],
)
def test_no_se_puede_cancelar_un_pedido_que_ya_salio(pedido, pasos_previos):
    for etapa in pasos_previos:
        pedido.cambiar_etapa(etapa)

    with pytest.raises(ValidationError):
        pedido.cambiar_etapa(Pedido.Etapa.CANCELADO)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "pasos_previos",
    [["cancelado"], ["en_preparacion", "en_camino", "entregado"]],
)
def test_entregado_y_cancelado_son_finales(pedido, pasos_previos):
    for etapa in pasos_previos:
        pedido.cambiar_etapa(etapa)

    assert pedido.etapas_siguientes() == []
    for etapa in Pedido.Etapa.values:
        with pytest.raises(ValidationError):
            pedido.cambiar_etapa(etapa)


# --- cambiar la etapa desde el panel ----------------------------------------------


@pytest.mark.django_db
def test_cambiar_etapa_rechaza_a_un_cliente(api, cliente, pedido):
    api.force_authenticate(cliente)

    respuesta = cambiar_etapa(api, pedido.id, "en_preparacion")

    assert respuesta.status_code == 403
    pedido.refresh_from_db()
    assert pedido.etapa == Pedido.Etapa.RECIBIDO


@pytest.mark.django_db
def test_cambiar_etapa_rechaza_a_un_anonimo(api, pedido):
    assert cambiar_etapa(api, pedido.id, "en_preparacion").status_code in (401, 403)


@pytest.mark.django_db
def test_el_personal_avanza_la_etapa(api, staff, pedido):
    api.force_authenticate(staff)

    respuesta = cambiar_etapa(api, pedido.id, "en_preparacion")

    assert respuesta.status_code == 200
    assert respuesta.data["etapa"] == "en_preparacion"
    assert respuesta.data["etapa_nombre"] == "En preparacion"
    assert respuesta.data["etapas_siguientes"] == ["en_camino", "cancelado"]
    seguimiento = respuesta.data["seguimiento"]
    assert [paso["etapa"] for paso in seguimiento] == ["recibido", "en_preparacion"]
    assert all(paso["fecha"] for paso in seguimiento)


@pytest.mark.django_db
def test_cambio_de_etapa_no_permitido_responde_400_con_mensaje(api, staff, pedido):
    api.force_authenticate(staff)

    respuesta = cambiar_etapa(api, pedido.id, "entregado")

    assert respuesta.status_code == 400
    assert "no puede pasar a entregado" in respuesta.data["detail"]
    pedido.refresh_from_db()
    assert pedido.etapa == Pedido.Etapa.RECIBIDO


@pytest.mark.django_db
def test_etapa_inexistente_responde_400(api, staff, pedido):
    api.force_authenticate(staff)

    assert cambiar_etapa(api, pedido.id, "perdido").status_code == 400


@pytest.mark.django_db
def test_cambiar_etapa_de_un_pedido_inexistente_responde_404(api, staff):
    api.force_authenticate(staff)

    assert cambiar_etapa(api, 9999, "en_preparacion").status_code == 404


@pytest.mark.django_db
def test_cambiar_la_etapa_no_toca_el_pago(api, staff, pedido):
    api.force_authenticate(staff)

    cambiar_etapa(api, pedido.id, "en_preparacion")
    cambiar_etapa(api, pedido.id, "cancelado")

    pedido.refresh_from_db()
    assert pedido.estado == Pedido.Estado.POR_CONFIRMAR
    assert pedido.pago.estado == Pago.Estado.PENDIENTE


@pytest.mark.django_db
def test_el_listado_del_panel_trae_y_filtra_por_etapa(api, staff, pedido, producto):
    otro = crear_pedido(producto, email="otro@example.com")
    otro.cambiar_etapa(Pedido.Etapa.EN_PREPARACION)
    api.force_authenticate(staff)

    respuesta = api.get("/api/pedidos/admin/", {"etapa": "en_preparacion"})

    assert respuesta.data["count"] == 1
    assert respuesta.data["results"][0]["id"] == otro.id
    assert respuesta.data["results"][0]["etapa"] == "en_preparacion"


# --- mis pedidos (cliente con sesion) ---------------------------------------------


@pytest.mark.django_db
def test_mis_pedidos_rechaza_a_un_anonimo(api):
    assert api.get("/api/pedidos/mios/").status_code in (401, 403)


@pytest.mark.django_db
def test_mis_pedidos_solo_lista_los_propios(api, cliente, producto):
    propio = crear_pedido(producto, usuario=cliente)
    crear_pedido(producto, email="otro@example.com")
    api.force_authenticate(cliente)

    respuesta = api.get("/api/pedidos/mios/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 1
    fila = respuesta.data["results"][0]
    assert fila["id"] == propio.id
    assert fila["etapa"] == "recibido"
    assert fila["etapa_nombre"] == "Recibido"
    assert fila["metodo_pago"] == "Transferencia"


@pytest.mark.django_db
def test_detalle_de_mi_pedido(api, cliente, producto):
    propio = crear_pedido(producto, usuario=cliente)
    propio.cambiar_etapa(Pedido.Etapa.EN_PREPARACION)
    api.force_authenticate(cliente)

    respuesta = api.get(f"/api/pedidos/mios/{propio.id}/")

    assert respuesta.status_code == 200
    assert respuesta.data["etapa"] == "en_preparacion"
    assert len(respuesta.data["seguimiento"]) == 2
    assert respuesta.data["items"][0]["nombre"] == "Lomo fino"


@pytest.mark.django_db
def test_el_detalle_de_un_pedido_ajeno_responde_404(api, cliente, producto):
    ajeno = crear_pedido(producto, email="otro@example.com")
    api.force_authenticate(cliente)

    assert api.get(f"/api/pedidos/mios/{ajeno.id}/").status_code == 404


# --- consultar sin cuenta -----------------------------------------------------------


@pytest.mark.django_db
def test_consultar_con_numero_y_correo(api, pedido):
    respuesta = api.post(
        "/api/pedidos/consultar/",
        {"numero": pedido.id, "email": "ANA@Example.com"},
        format="json",
    )

    assert respuesta.status_code == 200
    assert respuesta.data["id"] == pedido.id
    assert respuesta.data["etapa"] == "recibido"


@pytest.mark.django_db
def test_consultar_con_un_correo_que_no_coincide_responde_404(api, pedido):
    respuesta = api.post(
        "/api/pedidos/consultar/",
        {"numero": pedido.id, "email": "intruso@example.com"},
        format="json",
    )

    assert respuesta.status_code == 404
    assert "etapa" not in respuesta.data


@pytest.mark.django_db
def test_consultar_un_numero_que_no_existe_responde_404(api, db):
    respuesta = api.post(
        "/api/pedidos/consultar/", {"numero": 9999, "email": "ana@example.com"}, format="json"
    )

    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_consultar_sin_datos_responde_400(api, db):
    assert api.post("/api/pedidos/consultar/", {}, format="json").status_code == 400
