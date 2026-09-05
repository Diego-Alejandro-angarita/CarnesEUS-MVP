from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.catalog.models import Categoria, Producto

CATEGORIAS = [
    ("Res", "8b1e2d"),
    ("Cerdo", "c46b6b"),
    ("Pollo", "d9a441"),
    ("Embutidos", "6b4226"),
]

PRODUCTOS = [
    ('Res', 'Lomo fino', 'Bandeja 500 g', 38900, True,
     'Corte magro y suave, ideal para termino medio.'),
    ('Res', 'Punta de anca', 'Bandeja 500 g', 34500, True,
     'Corte jugoso con capa de grasa para asar.'),
    ('Res', 'Churrasco', 'Bandeja 400 g', 29900, True,
     'Corte delgado listo para la parrilla.'),
    ('Res', 'Costilla de res', 'Bandeja 1 kg', 26500, True,
     'Ideal para sancocho y cocciones largas.'),
    ('Res', 'Carne molida especial', 'Bandeja 500 g', 18900, True,
     'Molida del dia, baja en grasa.'),
    ('Res', 'Sobrebarriga', 'Bandeja 800 g', 31500, True,
     'Perfecta para hornear o sudar.'),
    ('Res', 'Bife de chorizo', 'Bandeja 350 g', 42500, False,
     'Corte grueso con excelente marmoleo.'),
    ('Res', 'Osobuco', 'Bandeja 900 g', 22900, True,
     'Con hueso y tuetano para caldos.'),
    ('Cerdo', 'Lomo de cerdo', 'Bandeja 700 g', 27900, True,
     'Magro y versatil, apto para horno.'),
    ('Cerdo', 'Costilla de cerdo BBQ', 'Bandeja 1 kg', 33900, True,
     'Costillar completo para ahumar.'),
    ('Cerdo', 'Chuleta de cerdo', 'Bandeja 500 g', 21500, True,
     'Corte con hueso para sarten o parrilla.'),
    ('Cerdo', 'Pernil deshuesado', 'Bandeja 1.5 kg', 45900, True,
     'Pieza entera para celebraciones.'),
    ('Cerdo', 'Tocineta ahumada', 'Paquete 250 g', 15900, True,
     'Ahumada en lena, corte grueso.'),
    ('Cerdo', 'Papada de cerdo', 'Bandeja 500 g', 12900, False,
     'Ideal para chicharron crocante.'),
    ('Pollo', 'Pechuga sin hueso', 'Bandeja 800 g', 23900, True,
     'Fileteada y limpia, lista para cocinar.'),
    ('Pollo', 'Muslos y contramuslos', 'Bandeja 1 kg', 17900, True,
     'Con piel, jugosos al horno.'),
    ('Pollo', 'Alas de pollo', 'Bandeja 900 g', 15500, True,
     'Perfectas para freir o marinar.'),
    ('Pollo', 'Pollo entero', 'Unidad 1.8 kg', 26900, True,
     'Pollo campesino listo para asar.'),
    ('Pollo', 'Pechuga apanada', 'Bandeja 600 g', 24900, False,
     'Empanizada artesanalmente.'),
    ('Pollo', 'Menudencias de pollo', 'Bandeja 500 g', 8900, True,
     'Higado, molleja y corazon.'),
    ('Embutidos', 'Chorizo santarrosano', 'Paquete 5 unidades', 16900, True,
     'Receta tradicional, sin conservantes.'),
    ('Embutidos', 'Morcilla criolla', 'Paquete 4 unidades', 12500, True,
     'Con arroz y especias de la casa.'),
    ('Embutidos', 'Salchicha ranchera', 'Paquete 6 unidades', 14900, True,
     'Ahumada, lista para la parrilla.'),
    ('Embutidos', 'Butifarra costena', 'Paquete 8 unidades', 13900, True,
     'Estilo Soledad, servida con limon.'),
    ('Embutidos', 'Longaniza artesanal', 'Paquete 400 g', 17500, False,
     'Curada lentamente con pimenton.'),
]


class Command(BaseCommand):
    help = "Carga un catalogo de ejemplo para probar FR-00."

    @transaction.atomic
    def handle(self, *args, **opciones):
        colores = dict(CATEGORIAS)
        categorias = {}
        for nombre, _ in CATEGORIAS:
            categoria, _creada = Categoria.objects.update_or_create(
                slug=slugify(nombre),
                defaults={"nombre": nombre},
            )
            categorias[nombre] = categoria

        for categoria, nombre, presentacion, precio, disponible, descripcion in PRODUCTOS:
            slug = slugify(nombre)
            etiqueta = nombre.replace(" ", "+")
            Producto.objects.update_or_create(
                slug=slug,
                defaults={
                    "categoria": categorias[categoria],
                    "nombre": nombre,
                    "descripcion": descripcion,
                    "presentacion": presentacion,
                    "precio": Decimal(precio),
                    "foto_url": (
                        f"https://placehold.co/600x400/{colores[categoria]}/ffffff"
                        f"?text={etiqueta}"
                    ),
                    "disponible": disponible,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Catalogo cargado: {len(categorias)} categorias y {len(PRODUCTOS)} productos."
            )
        )
