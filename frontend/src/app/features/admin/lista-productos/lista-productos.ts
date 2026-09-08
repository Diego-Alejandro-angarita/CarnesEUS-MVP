import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CatalogoService, PaginaProductos, TAMANO_PAGINA } from '../../catalogo/catalogo.service';
import { AdminProductosService } from '../admin-productos.service';

type EstadoListado = 'cargando' | 'ok' | 'error';

/**
 * Listado de administracion: la puerta de entrada para modificar (FR-04) y
 * eliminar (FR-05) un producto. Reutiliza el mismo endpoint paginado que el
 * catalogo publico.
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
  protected readonly errorEliminar = signal('');

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
    this.errorEliminar.set('');
    this.confirmando.set(id);
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  protected async eliminar(id: number): Promise<void> {
    this.errorEliminar.set('');
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
      this.errorEliminar.set('No pudimos eliminar el producto. Intentalo de nuevo.');
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
