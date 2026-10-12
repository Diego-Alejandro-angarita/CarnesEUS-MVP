import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AdminPromocionesService,
  EstadoPromocion,
  PaginaPromociones,
  Promocion,
  TAMANO_PAGINA_PROMOCIONES,
} from '../admin-promociones.service';
import { esSinPermiso } from '../sin-permiso';

type EstadoListado = 'cargando' | 'ok' | 'error' | 'sin-permiso';

const ETIQUETAS: Record<EstadoPromocion, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
  inactiva: 'Inactiva',
};

/** Listado de promociones (FR-13): la puerta para crearlas, editarlas y borrarlas. */
@Component({
  selector: 'app-lista-promociones',
  imports: [DatePipe, RouterLink],
  templateUrl: './lista-promociones.html',
  styleUrl: './lista-promociones.scss',
})
export class ListaPromociones {
  private readonly admin = inject(AdminPromocionesService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly page = input(1, { transform: numberAttribute });

  protected readonly etiquetas = ETIQUETAS;
  protected readonly estado = signal<EstadoListado>('cargando');
  protected readonly pagina = signal<PaginaPromociones | null>(null);
  /** Id de la promocion que espera confirmacion para eliminarse. */
  protected readonly confirmando = signal<number | null>(null);
  protected readonly eliminando = signal<number | null>(null);
  protected readonly errorAccion = signal('');

  protected readonly paginaActual = computed(() => {
    const numero = this.page();
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1;
  });
  protected readonly promociones = computed(() => this.pagina()?.results ?? []);
  protected readonly total = computed(() => this.pagina()?.count ?? 0);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA_PROMOCIONES)),
  );
  protected readonly hayAnterior = computed(() => this.pagina()?.previous != null);
  protected readonly haySiguiente = computed(() => this.pagina()?.next != null);

  constructor() {
    effect(() => void this.cargar(this.paginaActual()));
  }

  protected irA(numero: number): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { page: numero > 1 ? numero : null },
      queryParamsHandling: 'merge',
    });
  }

  /** Para el tooltip de la columna de productos. */
  protected nombresDe(promocion: Promocion): string {
    return promocion.productos_detalle.map((producto) => producto.nombre).join(', ');
  }

  protected pedirConfirmacion(id: number): void {
    this.errorAccion.set('');
    this.confirmando.set(id);
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  protected async eliminar(id: number): Promise<void> {
    this.errorAccion.set('');
    this.eliminando.set(id);

    try {
      await firstValueFrom(this.admin.eliminar(id));
      this.confirmando.set(null);

      // Si era la ultima de la pagina, la pagina deja de existir.
      if (this.promociones().length === 1 && this.paginaActual() > 1) {
        this.irA(this.paginaActual() - 1);
      } else {
        await this.cargar(this.paginaActual());
      }
    } catch {
      this.errorAccion.set('No pudimos eliminar la promocion. Intentalo de nuevo.');
    } finally {
      this.eliminando.set(null);
    }
  }

  private async cargar(numero: number): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.admin.listar(numero)));
      this.estado.set('ok');
    } catch (error) {
      this.pagina.set(null);
      this.estado.set(esSinPermiso(error) ? 'sin-permiso' : 'error');
    }
  }
}
