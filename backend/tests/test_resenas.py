from decimal import Decimal

import pytest

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.pedidos.models import ItemPedido, Pago, Pedido
from apps.resenas.models import Resena


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


@pytest.fixture
def compro(producto):
    """Crea un pedido pagado del producto a nombre de quien se le pase."""

    def _compro(usuario):
        pedido = Pedido.objects.create(
            usuario=usuario,
            nombre="Ana Gomez",
            email="ana@example.com",
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

    return _compro


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")


@pytest.fixture
def cliente_autenticado(api, usuario):
    api.force_authenticate(usuario)
    return api


# --- listado publico ---------------------------------------------------------


@pytest.mark.django_db
def test_listado_de_resenas_es_publico(api, producto, usuario):
    Resena.objects.create(producto=producto, usuario=usuario, calificacion=5, comentario="Excelente")

    respuesta = api.get(f"/api/productos/{producto.slug}/resenas/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 1
    assert respuesta.data["results"][0]["calificacion"] == 5
    assert respuesta.data["results"][0]["comentario"] == "Excelente"
    assert respuesta.data["results"][0]["usuario_nombre"]


@pytest.mark.django_db
def test_producto_sin_resenas_responde_lista_vacia(api, producto):
    respuesta = api.get(f"/api/productos/{producto.slug}/resenas/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 0


@pytest.mark.django_db
def test_listado_de_producto_inexistente_responde_404(api):
    respuesta = api.get("/api/productos/no-existe/resenas/")

    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_es_propia_distingue_la_resena_del_usuario_que_pregunta(
    api, producto, usuario, cliente_autenticado
):
    otro = Usuario.objects.create_user(email="otro@example.com", password="UnaClaveSegura123")
    Resena.objects.create(producto=producto, usuario=usuario, calificacion=5, comentario="Mia")
    Resena.objects.create(producto=producto, usuario=otro, calificacion=3, comentario="De otro")

    resultados = cliente_autenticado.get(f"/api/productos/{producto.slug}/resenas/").data["results"]

    propias = {item["comentario"]: item["es_propia"] for item in resultados}
    assert propias["Mia"] is True
    assert propias["De otro"] is False


# --- crear una resena ---------------------------------------------------------


@pytest.mark.django_db
def test_crear_resena_requiere_sesion(api, producto):
    respuesta = api.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": 5, "comentario": "Muy bueno"},
        format="json",
    )

    assert respuesta.status_code in (401, 403)
    assert Resena.objects.count() == 0


@pytest.mark.django_db
def test_crear_resena_sin_haber_comprado_se_rechaza(cliente_autenticado, producto):
    respuesta = cliente_autenticado.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": 4, "comentario": "Se ve bien"},
        format="json",
    )

    assert respuesta.status_code == 403
    assert Resena.objects.count() == 0


@pytest.mark.django_db
def test_crear_resena_tras_comprar_el_producto(cliente_autenticado, producto, usuario, compro):
    compro(usuario)

    respuesta = cliente_autenticado.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": 4, "comentario": "Muy fresco"},
        format="json",
    )

    assert respuesta.status_code == 201
    resena = Resena.objects.get()
    assert resena.producto == producto
    assert resena.usuario == usuario
    assert resena.calificacion == 4
    assert resena.comentario == "Muy fresco"


@pytest.mark.django_db
def test_no_se_puede_resenar_dos_veces_el_mismo_producto(
    cliente_autenticado, producto, usuario, compro
):
    compro(usuario)
    Resena.objects.create(producto=producto, usuario=usuario, calificacion=5, comentario="Primera")

    respuesta = cliente_autenticado.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": 2, "comentario": "Segunda"},
        format="json",
    )

    assert respuesta.status_code == 400
    assert Resena.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("calificacion", [0, 6, -1])
def test_la_calificacion_debe_estar_entre_1_y_5(
    cliente_autenticado, producto, usuario, compro, calificacion
):
    compro(usuario)

    respuesta = cliente_autenticado.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": calificacion, "comentario": ""},
        format="json",
    )

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_el_comentario_es_opcional(cliente_autenticado, producto, usuario, compro):
    compro(usuario)

    respuesta = cliente_autenticado.post(
        f"/api/productos/{producto.slug}/resenas/",
        {"calificacion": 5, "comentario": ""},
        format="json",
    )

    assert respuesta.status_code == 201


# --- editar y eliminar la propia ---------------------------------------------


@pytest.mark.django_db
def test_editar_la_propia_resena(cliente_autenticado, producto, usuario):
    resena = Resena.objects.create(
        producto=producto, usuario=usuario, calificacion=3, comentario="Regular"
    )

    respuesta = cliente_autenticado.patch(
        f"/api/resenas/{resena.id}/", {"calificacion": 5, "comentario": "Cambie de opinion"}
    )

    assert respuesta.status_code == 200
    resena.refresh_from_db()
    assert resena.calificacion == 5
    assert resena.comentario == "Cambie de opinion"


@pytest.mark.django_db
def test_no_se_puede_editar_la_resena_de_otro(api, producto, usuario):
    otro = Usuario.objects.create_user(email="otro@example.com", password="UnaClaveSegura123")
    resena = Resena.objects.create(
        producto=producto, usuario=usuario, calificacion=3, comentario="Regular"
    )
    api.force_authenticate(otro)

    respuesta = api.patch(f"/api/resenas/{resena.id}/", {"calificacion": 1})

    assert respuesta.status_code == 404
    resena.refresh_from_db()
    assert resena.calificacion == 3


@pytest.mark.django_db
def test_eliminar_la_propia_resena(cliente_autenticado, producto, usuario):
    resena = Resena.objects.create(
        producto=producto, usuario=usuario, calificacion=3, comentario="Regular"
    )

    respuesta = cliente_autenticado.delete(f"/api/resenas/{resena.id}/")

    assert respuesta.status_code == 204
    assert Resena.objects.count() == 0


# --- saber si puede resenar ----------------------------------------------------


@pytest.mark.django_db
def test_puede_resenar_sin_haber_comprado(cliente_autenticado, producto):
    respuesta = cliente_autenticado.get(f"/api/productos/{producto.slug}/resenas/puede-resenar/")

    assert respuesta.status_code == 200
    assert respuesta.data == {"ha_comprado": False, "ya_reseno": False, "puede_resenar": False}


@pytest.mark.django_db
def test_puede_resenar_tras_comprar(cliente_autenticado, producto, usuario, compro):
    compro(usuario)

    respuesta = cliente_autenticado.get(f"/api/productos/{producto.slug}/resenas/puede-resenar/")

    assert respuesta.data == {"ha_comprado": True, "ya_reseno": False, "puede_resenar": True}


@pytest.mark.django_db
def test_puede_resenar_es_falso_si_ya_reseno(cliente_autenticado, producto, usuario, compro):
    compro(usuario)
    Resena.objects.create(producto=producto, usuario=usuario, calificacion=5, comentario="")

    respuesta = cliente_autenticado.get(f"/api/productos/{producto.slug}/resenas/puede-resenar/")

    assert respuesta.data == {"ha_comprado": True, "ya_reseno": True, "puede_resenar": False}


# --- integracion con la ficha del producto ------------------------------------


@pytest.mark.django_db
def test_la_ficha_del_producto_expone_el_promedio_y_el_total(api, producto, usuario):
    otro = Usuario.objects.create_user(email="otro@example.com", password="UnaClaveSegura123")
    Resena.objects.create(producto=producto, usuario=usuario, calificacion=5, comentario="")
    Resena.objects.create(producto=producto, usuario=otro, calificacion=3, comentario="")

    respuesta = api.get(f"/api/productos/{producto.slug}/")

    assert respuesta.data["calificacion_promedio"] == 4.0
    assert respuesta.data["total_resenas"] == 2


@pytest.mark.django_db
def test_la_ficha_de_un_producto_sin_resenas_no_rompe(api, producto):
    respuesta = api.get(f"/api/productos/{producto.slug}/")

    assert respuesta.data["calificacion_promedio"] is None
    assert respuesta.data["total_resenas"] == 0
