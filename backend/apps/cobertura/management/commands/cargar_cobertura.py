from django.core.management.base import BaseCommand

from apps.cobertura.models import ZonaCobertura

# Datos de ejemplo para ver el indicador funcionando. La cobertura real la define
# el negocio: se edita desde el admin de Django (/admin/cobertura/).
ZONAS_EJEMPLO = {
    # Los nombres son los de las comunas del menu del frontend (FR-15). Solo
    # algunas quedan cubiertas para poder ver tambien el resultado "fuera de zona".
    "Medellin": [
        "Laureles-Estadio",
        "El Poblado",
        "Belen",
        "La America",
        "Guayabal",
        "La Candelaria",
    ],

    "Envigado": ["Centro", "Zuniga", "Las Antillas"],
    "Sabaneta": ["Centro", "Aves Maria"],
    "Itagui": ["Centro", "San Pio"],
}


class Command(BaseCommand):
    help = "Carga barrios de ejemplo en la zona de cobertura (se puede repetir sin duplicar)."

    def handle(self, *args, **options):
        creadas = 0
        for municipio, barrios in ZONAS_EJEMPLO.items():
            for barrio in barrios:
                clave = ZonaCobertura.construir_clave(municipio, barrio)
                _, creada = ZonaCobertura.objects.update_or_create(
                    clave=clave,
                    defaults={"municipio": municipio, "barrio": barrio, "activa": True},
                )
                creadas += creada

        total = ZonaCobertura.objects.filter(activa=True).count()
        self.stdout.write(
            self.style.SUCCESS(f"Cobertura lista: {creadas} nuevas, {total} activas en total.")
        )