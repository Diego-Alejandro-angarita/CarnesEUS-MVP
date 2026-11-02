"""
FR-13 Gestion de promociones: pruebas de propiedades.

En vez de unos pocos ejemplos escritos a mano, Hypothesis genera cientos de
precios, porcentajes y combinaciones de promociones y comprueba que las reglas
de negocio se cumplan en todos.
"""

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.catalog.models import Categoria, Producto
from apps.promotions.models import Promocion
from apps.promotions.precios import anotar_descuento, precio_con_descuento

precios = st.decimals(
    min_value=Decimal("0.01"), max_value=Decimal("99999999.99"), places=2, allow_nan=False
)
porcentajes = st.integers(min_value=1, max_value=99)


@given(precio=precios, porcentaje=porcentajes)
def test_el_precio_rebajado_queda_entre_cero_y_el_de_lista(precio, porcentaje):
    rebajado = precio_con_descuento(precio, porcentaje)
    exacto = precio * (100 - porcentaje) / 100

    assert Decimal("0") <= rebajado <= precio  # un descuento nunca encarece
    # En pesos enteros, salvo cuando redondear lo subiria sobre el de lista.
    assert rebajado == rebajado.to_integral_value() or rebajado == precio
    assert abs(rebajado - exacto) <= Decimal("0.5")  # solo se redondea
    if porcentaje < 99:
        # Un descuento mayor nunca deja un precio mas alto.
        assert precio_con_descuento(precio, porcentaje + 1) <= rebajado


# Cada promocion: porcentaje, dia de inicio relativo a hoy, duracion y si esta activa.
promociones = st.lists(
    st.tuples(
        porcentajes,
        st.integers(min_value=-10, max_value=10),
        st.integers(min_value=0, max_value=10),
        st.booleans(),
    ),
    max_size=5,
)


class TestDescuentoAplicado(TestCase):
    """Cada ejemplo corre en su propia transaccion, que se deshace al terminar."""

    @settings(max_examples=60, deadline=None)
    @given(promociones=promociones)
    def test_solo_cuentan_las_vigentes_y_gana_la_mayor(self, promociones):
        categoria = Categoria.objects.create(nombre="Res", slug="res")
        lomo = Producto.objects.create(
            categoria=categoria,
            nombre="Lomo fino",
            slug="lomo-fino",
            presentacion="Bandeja 500 g",
            precio=Decimal("38900"),
        )
        hoy = timezone.localdate()
        vigentes = []
        for porcentaje, desfase, duracion, activa in promociones:
            inicio = hoy + timedelta(days=desfase)
            fin = inicio + timedelta(days=duracion)
            promocion = Promocion.objects.create(
                nombre="Promo",
                porcentaje=porcentaje,
                fecha_inicio=inicio,
                fecha_fin=fin,
                activa=activa,
            )
            promocion.productos.set([lomo])
            if activa and inicio <= hoy <= fin:
                vigentes.append(porcentaje)

        descuento = anotar_descuento(Producto.objects.filter(pk=lomo.pk)).get().descuento

        # Las pausadas, las programadas y las vencidas no tocan el precio; de
        # las que rigen se aplica la de mayor porcentaje, sin sumarse.
        assert descuento == (max(vigentes) if vigentes else None)
