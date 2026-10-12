import json
import logging

from django.conf import settings

from . import servicios

logger = logging.getLogger(__name__)
SEGMENTOS = ("nuevo", "recurrente", "inactivo")

PROMPT = """Eres analista comercial de CarnesEUS, una carniceria en linea del Valle de Aburra.
Recibes estadisticas de ventas en JSON. Responde SOLO con un JSON con esta forma:
{"sugerencias": ["...", "...", "..."],
 "campanas": [{"segmento": "nuevo|recurrente|inactivo", "mensaje": "..."}]}
- 3 sugerencias concretas y accionables basadas en los datos (combos, productos a impulsar, etc.).
- Un mensaje corto de WhatsApp por segmento, cercano y en español de Colombia, sin inventar precios."""


def contexto(desde, hasta) -> dict:
    """Solo agregados: al modelo nunca le llegan nombres, correos ni telefonos."""
    resumen = servicios.resumen(desde, hasta)
    productos = servicios.productos(desde, hasta)
    clientes = servicios.clientes()
    return {
        "total_vendido": float(resumen["total_vendido"]),
        "numero_pedidos": resumen["numero_pedidos"],
        "ticket_promedio": float(resumen["ticket_promedio"]),
        "mas_vendidos": [
            {"producto": p["nombre"], "unidades": p["unidades"]}
            for p in productos["mas_vendidos"][:5]
        ],
        "por_categoria": [
            {"categoria": c["categoria"], "ingresos": float(c["ingresos"])}
            for c in productos["por_categoria"]
        ],
        "segmentos": clientes["segmentos"],
        "destinatarios": {
            s: sum(1 for c in clientes["clientes"]
                   if c["segmento"] == s and c["acepta_comunicaciones"])
            for s in SEGMENTOS
        },
    }


def sugerencias_por_reglas(ctx: dict) -> dict:
    estrella = ctx["mas_vendidos"][0]["producto"] if ctx["mas_vendidos"] else "nuestros cortes"
    return {
        "sugerencias": [
            f"Arma un combo alrededor de {estrella}, que es lo que mas se vende.",
            "Recupera a los clientes inactivos con un descuento de regreso.",
            "Premia a los recurrentes con envio gratis en su proxima compra.",
        ],
        "campanas": [
            {"segmento": "nuevo",
             "mensaje": f"¡Gracias por tu primera compra! Esta semana tenemos {estrella} fresquito."},
            {"segmento": "recurrente",
             "mensaje": "Eres de la casa: tu proximo pedido va con envio gratis."},
            {"segmento": "inactivo",
             "mensaje": "Hace rato no te vemos. Vuelve y te damos un descuento en tu pedido."},
        ],
    }


def sugerencias_con_ia(ctx: dict) -> dict:
    import anthropic

    cliente = anthropic.Anthropic(api_key=settings.IA_API_KEY)
    respuesta = cliente.messages.create(
        model=settings.IA_MODELO,
        max_tokens=1500,
        system=PROMPT,
        messages=[{"role": "user", "content": json.dumps(ctx, ensure_ascii=False)}],
    )
    texto = respuesta.content[0].text
    # A veces el modelo envuelve el JSON en ```: se toma de la primera { a la ultima }.
    datos = json.loads(texto[texto.index("{"): texto.rindex("}") + 1])
    return {"sugerencias": datos["sugerencias"][:5], "campanas": datos["campanas"]}


def generar(desde, hasta) -> dict:
    ctx = contexto(desde, hasta)
    origen, resultado = "reglas", None
    if settings.IA_API_KEY:
        try:
            resultado, origen = sugerencias_con_ia(ctx), "ia"
        except Exception:
            logger.exception("FR-06: fallo la IA, se usan reglas")
    resultado = resultado or sugerencias_por_reglas(ctx)

    # El backend decide a cuantos les llega cada campaña, no el modelo.
    campanas = [
        {"segmento": c["segmento"], "mensaje": c["mensaje"],
         "destinatarios": ctx["destinatarios"].get(c["segmento"], 0)}
        for c in resultado["campanas"] if c.get("segmento") in SEGMENTOS
    ]
    return {"origen": origen, "sugerencias": resultado["sugerencias"], "campanas": campanas}
