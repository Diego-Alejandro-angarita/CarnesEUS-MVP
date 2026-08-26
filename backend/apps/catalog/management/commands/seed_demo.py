"""
Carga datos de ejemplo para poder revisar las pantallas.

Sin catalogo no hay nada que mirar: ni la tienda, ni el carrito, ni el panel
del personal. Es idempotente, se puede correr las veces que haga falta.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.models import Direccion
from apps.accounts.services import esta_en_zona_cobertura
from apps.catalog.models import Categoria, Producto

Usuario = get_user_model()

CATEGORIAS = [
    ("Res", "Cortes de res frescos, de novillo joven.", 1),
    ("Cerdo", "Cortes de cerdo seleccionados.", 2),
    ("Pollo", "Pollo fresco despresado y entero.", 3),
    ("Embutidos", "Chorizos, morcillas y salchichas artesanales.", 4),
    ("Especiales", "Cortes para asado y ocasiones especiales.", 5),
]

# (categoria, nombre, precio COP, unidad, stock, descripcion)
PRODUCTOS = [
    ("Res", "Lomo fino", 52000, "KG", 25, "Corte magro y suave, ideal para medallones."),
    ("Res", "Punta de anca", 44000, "KG", 30, "Con su capa de grasa, perfecta para el asador."),
    ("Res", "Sobrebarriga", 32000, "KG", 20, "Para sudar a fuego lento o llevar al horno."),
    ("Res", "Carne molida especial", 28000, "KG", 40, "Molida del dia, baja en grasa."),
    ("Res", "Costilla de res", 26000, "KG", 22, "Con buen hueso, para sancocho o barbacoa."),
    ("Res", "Churrasco", 48000, "KG", 18, "Corte delgado de lomo ancho, listo para la parrilla."),
    ("Cerdo", "Lomo de cerdo", 30000, "KG", 25, "Magro y versatil, al horno o en chuletas."),
    ("Cerdo", "Costilla de cerdo", 27000, "KG", 28, "Carnuda, ideal para ahumar o glasear."),
    ("Cerdo", "Tocineta ahumada", 38000, "KG", 15, "Ahumada en casa, tajada gruesa."),
    ("Cerdo", "Pernil de cerdo", 24000, "KG", 20, "Pieza entera o en trozos, para hornear."),
    ("Pollo", "Pechuga de pollo", 22000, "KG", 45, "Sin hueso ni piel, fileteada."),
    ("Pollo", "Alas de pollo", 16000, "KG", 35, "Frescas, en dos presas."),
    ("Pollo", "Pollo entero", 19000, "UNIDAD", 30, "Pollo de aproximadamente 2 kg, limpio."),
    ("Embutidos", "Chorizo santarrosano", 25000, "KG", 30, "Receta tradicional, paquete de 5."),
    ("Embutidos", "Morcilla", 20000, "KG", 20, "Rellena con arroz y especias de la casa."),
    ("Embutidos", "Salchicha ranchera", 23000, "KG", 25, "Ahumada, lista para calentar."),
    ("Especiales", "Picada mixta para asado", 42000, "KG", 12, "Res, cerdo, pollo y chorizo."),
    (
        "Especiales",
        "Bandeja parrillada familiar",
        95000,
        "UNIDAD",
        8,
        "Para 4 personas, con chorizo y morcilla.",
    ),
]


class Command(BaseCommand):
    help = "Carga categorias, productos y usuarios de ejemplo."

    @transaction.atomic
    def handle(self, *args, **options):
        categorias = {}
        for nombre, descripcion, orden in CATEGORIAS:
            categoria, _ = Categoria.objects.update_or_create(
                slug=slugify(nombre),
                defaults={"nombre": nombre, "descripcion": descripcion, "orden": orden},
            )
            categorias[nombre] = categoria
        self.stdout.write(f"Categorias: {len(categorias)}")

        for categoria, nombre, precio, unidad, stock, descripcion in PRODUCTOS:
            Producto.objects.update_or_create(
                slug=slugify(nombre),
                defaults={
                    "nombre": nombre,
                    "descripcion": descripcion,
                    "categoria": categorias[categoria],
                    "precio": Decimal(precio),
                    "unidad_medida": unidad,
                    "stock": Decimal(stock),
                    "disponible": True,
                },
            )
        self.stdout.write(f"Productos: {len(PRODUCTOS)}")

        cliente = self._crear_usuario(
            email="cliente@carneseus.co",
            nombre="Cliente de Prueba",
            rol=Usuario.Rol.CLIENTE,
        )
        self._crear_usuario(
            email="staff@carneseus.co",
            nombre="Personal de la Carniceria",
            rol=Usuario.Rol.STAFF,
        )

        Direccion.objects.get_or_create(
            usuario=cliente,
            etiqueta="Casa",
            defaults={
                "ciudad": "Medellin",
                "barrio": "Laureles",
                "direccion": "Calle 33 #75-20",
                "es_principal": True,
                "en_zona_cobertura": esta_en_zona_cobertura("Medellin"),
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\nDatos de ejemplo listos.\n"
                "  cliente@carneseus.co / demo12345\n"
                "  staff@carneseus.co   / demo12345"
            )
        )

    def _crear_usuario(self, email, nombre, rol):
        usuario = Usuario.objects.filter(email=email).first()
        if usuario:
            return usuario
        return Usuario.objects.create_user(
            email=email,
            password="demo12345",
            nombre_completo=nombre,
            telefono="3001234567",
            rol=rol,
        )
