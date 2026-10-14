import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Producto
from apps.pedidos.models import ItemPedido, Pago, Pedido

DOMINIO_DEMO = "demo.carneseus.test"
NOMBRES = ["Ana", "Luis", "Camila", "Andres", "Valentina", "Santiago", "Laura", "Mateo",
           "Sara", "Juan", "Daniela", "Felipe", "Mariana", "Sebastian", "Isabel", "Tomas"]
BARRIOS = [("Medellin", "Laureles"), ("Medellin", "El Poblado"), ("Medellin", "Belen"),
           ("Envigado", "Zuniga"), ("Itagui", "Centro"), ("Bello", "Niquia")]
ESTADOS = [Pedido.Estado.PAGADO] * 8 + [Pedido.Estado.POR_CONFIRMAR, Pedido.Estado.POR_COBRAR]


class Command(BaseCommand):
    help = "Crea pedidos de ejemplo para el dashboard de estadisticas (FR-06)."

    def add_arguments(self, parser):
        parser.add_argument("--pedidos", type=int, default=200)
        parser.add_argument("--dias", type=int, default=90)
        parser.add_argument("--borrar", action="store_true")

    @transaction.atomic
    def handle(self, *args, **op):
        productos = list(Producto.objects.visibles())
        if not productos:
            raise CommandError("No hay productos. Corra primero: python manage.py cargar_catalogo")
        if op["borrar"]:
            Pedido.objects.filter(email__endswith=DOMINIO_DEMO).delete()

        azar = random.Random(42)
        ahora = timezone.now()
        clientes = [
            (n, f"{n.lower()}{i}@{DOMINIO_DEMO}", azar.choice(BARRIOS), azar.random() < 0.6)
            for i, n in enumerate(NOMBRES)
        ]
        pesos = [1 / (i + 1) for i in range(len(clientes))]  # pocos compran mucho

        for _ in range(op["pedidos"]):
            nombre, email, (municipio, barrio), acepta = azar.choices(clientes, pesos)[0]
            lineas = [(p, azar.randint(1, 3))
                      for p in azar.sample(productos, k=azar.randint(1, min(3, len(productos))))]
            total = sum(p.precio * c for p, c in lineas)
            pedido = Pedido.objects.create(
                nombre=nombre, email=email, telefono="3000000000",
                direccion="Calle demo # 1-23", municipio=municipio, barrio=barrio,
                estado=azar.choice(ESTADOS), total=total, acepta_comunicaciones=acepta,
            )
            ItemPedido.objects.bulk_create(
                ItemPedido(pedido=pedido, producto=p, nombre=p.nombre,
                           precio_unitario=p.precio, cantidad=c)
                for p, c in lineas
            )
            Pago.objects.create(
                pedido=pedido, metodo=azar.choice(Pago.Metodo.values), monto=total,
                estado=Pago.Estado.APROBADO if pedido.estado == Pedido.Estado.PAGADO
                else Pago.Estado.PENDIENTE,
            )
            fecha = ahora - timedelta(days=azar.randint(0, op["dias"]), hours=azar.randint(0, 12))
            Pedido.objects.filter(pk=pedido.pk).update(creado_en=fecha)

        self.stdout.write(self.style.SUCCESS(f"Creados {op['pedidos']} pedidos demo."))
