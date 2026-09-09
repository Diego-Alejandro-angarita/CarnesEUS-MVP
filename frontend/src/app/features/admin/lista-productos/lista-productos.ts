import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CatalogoService, PaginaProductos, TAMANO_PAGINA } from '../../catalogo/catalogo.service';
import { AdminProductosService } from '../admin-productos.service';

type EstadoListado = 'cargando' | 'ok' | 'error';

/**
 * Listado de administracion: la puerta de entrada para modificar (FR-04),
 * eliminar (FR-05) y cambiar la disponibilidad (FR-09) de un producto.
 * Reutiliza el mismo endpoint paginado que el catalogo publico.
 */
@Component({
  selector: 'app-lista-productos',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './lista-productos.html',
  styleUrl: './lista-productos.scss',
})
export class ListaProductos {
  private readonly catalogo = inject(CatalogoService);
  private readonly admin = inject(AdminProductosService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly page = input(1, { transform: numberAttribute });

  protected readonly estado = signal<EstadoListado>('cargando');
  protected readonly pagina = signal<PaginaProductos | null>(null);
  /** Id del producto que espera confirmacion para eliminarse. */
  protected readonly confirmando = signal<number | null>(null);
  protected readonly eliminando = signal<number | null>(null);
  /** Id del producto cuyo cambio de disponibilidad esta en curso. */
  protected readonly cambiando = signal<number | null>(null);
  /** Un solo aviso para lo que falle sobre una fila. */
  protected readonly errorAccion = signal('');

  protected readonly paginaActual = computed(() => {
    const numero = this.page();
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1;
  });
  protected readonly productos = computed(() => this.pagina()?.results ?? []);
  protected readonly total = computed(() => this.pagina()?.count ?? 0);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)),
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

  protected pedirConfirmacion(id: number): void {
    this.errorAccion.set('');
    this.confirmando.set(id);
  }

  /**
   * Pone o quita el producto del catalogo. La fila se queda donde esta: el
   * orden solo se recalcula al recargar, y mover la fila bajo el cursor
   * despues de un clic desorienta.
   */
  protected async alternarDisponibilidad(id: number, disponible: boolean): Promise<void> {
    this.errorAccion.set('');
    this.cambiando.set(id);

    try {
      const producto = await firstValueFrom(this.admin.cambiarDisponibilidad(id, !disponible));
      this.pagina.update((pagina) =>
        pagina
          ? {
              ...pagina,
              results: pagina.results.map((item) =>
                item.id === id ? { ...item, disponible: producto.disponible } : item,
              ),
            }
          : pagina,
      );
    } catch {
      this.errorAccion.set('No pudimos cambiar la disponibilidad. Intentalo de nuevo.');
    } finally {
      this.cambiando.set(null);
    }
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

      // Si era el ultimo de la pagina, la pagina deja de existir.
      if (this.productos().length === 1 && this.paginaActual() > 1) {
        this.irA(this.paginaActual() - 1);
      } else {
        await this.cargar(this.paginaActual());
      }
    } catch {
      this.errorAccion.set('No pudimos eliminar el producto. Intentalo de nuevo.');
    } finally {
      this.eliminando.set(null);
    }
  }

  private async cargar(numero: number): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.catalogo.listar(numero)));
      this.estado.set('ok');
    } catch {
      this.pagina.set(null);
      this.estado.set('error');
    }
  }
}
