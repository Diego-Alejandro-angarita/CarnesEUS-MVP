from datetime import date, timedelta

from django.db.models import Count, F, Max, Min, Q, Sum
from django.db.models.functions import TruncDay
from django.utils import timezone

from apps.pedidos.models import ItemPedido, Pedido

DIAS_INACTIVO = 30


def pedidos_pagados(desde: date, hasta: date):
    return Pedido.objects.filter(
        estado=Pedido.Estado.PAGADO,
        creado_en__date__gte=desde,
        creado_en__date__lte=hasta,
    )


def resumen(desde: date, hasta: date) -> dict:
    pedidos = pedidos_pagados(desde, hasta)
    totales = pedidos.aggregate(
        total_vendido=Sum("total"),
        numero_pedidos=Count("id"),
        clientes_unicos=Count("email", distinct=True),
    )
    total = totales["total_vendido"] or 0
    numero = totales["numero_pedidos"]
    ventas_por_dia = (
        pedidos.annotate(dia=TruncDay("creado_en"))
        .values("dia")
        .annotate(total=Sum("total"), pedidos=Count("id"))
        .order_by("dia")
    )
    return {
        "desde": desde,
        "hasta": hasta,
        "total_vendido": total,
        "numero_pedidos": numero,
        "ticket_promedio": round(total / numero, 2) if numero else 0,
        "clientes_unicos": totales["clientes_unicos"],
        "ventas_por_dia": [
            {"dia": f["dia"].date(), "total": f["total"], "pedidos": f["pedidos"]}
            for f in ventas_por_dia
        ],
    }


def productos(desde: date, hasta: date, limite: int = 10) -> dict:
    pedidos = pedidos_pagados(desde, hasta)
    items = ItemPedido.objects.filter(pedido__in=pedidos)
    ingresos = Sum(F("precio_unitario") * F("cantidad"))
    return {
        "mas_vendidos": list(
            items.values("producto_id", "nombre")
            .annotate(unidades=Sum("cantidad"), ingresos=ingresos)
            .order_by("-ingresos")[:limite]
        ),
        "por_categoria": list(
            items.values(categoria=F("producto__categoria__nombre"))
            .annotate(unidades=Sum("cantidad"), ingresos=ingresos)
            .order_by("-ingresos")
        ),
        "por_barrio": list(
            pedidos.values("municipio", "barrio")
            .annotate(pedidos=Count("id"), total=Sum("total"))
            .order_by("-total")
        ),
        "por_metodo_pago": list(
            pedidos.values(metodo=F("pago__metodo"))
            .annotate(pedidos=Count("id"), total=Sum("total"))
            .order_by("-total")
        ),
    }


def segmento_de(compras: int, ultima_compra, hoy) -> str:
    if ultima_compra.date() < hoy - timedelta(days=DIAS_INACTIVO):
        return "inactivo"
    return "recurrente" if compras >= 2 else "nuevo"


def clientes() -> dict:
    """Todo el historial, no un rango: 'inactivo' depende de la ultima compra."""
    hoy = timezone.localdate()
    filas = (
        Pedido.objects.filter(estado=Pedido.Estado.PAGADO)
        .values("email")
        .annotate(
            nombre=Max("nombre"),
            compras=Count("id"),
            total_gastado=Sum("total"),
            primera_compra=Min("creado_en"),
            ultima_compra=Max("creado_en"),
            pedidos_con_consentimiento=Count("id", filter=Q(acepta_comunicaciones=True)),
        )
        .order_by("-total_gastado")
    )
    lista, conteo = [], {"nuevo": 0, "recurrente": 0, "inactivo": 0}
    for f in filas:
        segmento = segmento_de(f["compras"], f["ultima_compra"], hoy)
        conteo[segmento] += 1
        lista.append({
            "email": f["email"],
            "nombre": f["nombre"],
            "compras": f["compras"],
            "total_gastado": f["total_gastado"],
            "ultima_compra": f["ultima_compra"],
            "segmento": segmento,
            "acepta_comunicaciones": f["pedidos_con_consentimiento"] > 0,
        })
    return {"segmentos": conteo, "clientes": lista}
