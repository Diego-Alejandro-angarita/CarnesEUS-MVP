import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  Categoria,
  CatalogoService,
  FiltrosProductos,
  PaginaProductos,
  TAMANO_PAGINA,
} from './catalogo.service';

type EstadoCatalogo = 'cargando' | 'ok' | 'error';

/** Convierte el valor crudo del query param (string, undefined si sale de la URL) a numero. */
function numeroOpcional(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

@Component({
  selector: 'app-catalogo',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly page = input(1, { transform: numberAttribute });
  readonly busqueda = input('');
  readonly categoria = input<number | null>(null, { transform: numeroOpcional });
  readonly precioMin = input<number | null>(null, {
    alias: 'precio_min',
    transform: numeroOpcional,
  });
  readonly precioMax = input<number | null>(null, {
    alias: 'precio_max',
    transform: numeroOpcional,
  });

  protected readonly estado = signal<EstadoCatalogo>('cargando');
  protected readonly pagina = signal<PaginaProductos | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly filtrosAbiertos = signal(false);

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
  // El binding de inputs del router deja el input en undefined cuando el
  // query param sale de la URL, sin importar que su tipo declarado sea
  // string: este computed es la unica fuente de verdad para mostrarlo.
  protected readonly busquedaTexto = computed(() => this.busqueda() ?? '');
  protected readonly hayFiltrosActivos = computed(
    () => this.categoria() != null || this.precioMin() != null || this.precioMax() != null,
  );

  constructor() {
    this.catalogo.categorias().subscribe((categorias) => this.categorias.set(categorias));

    effect(() => {
      void this.cargar(this.paginaActual(), this.busquedaTexto(), {
        categoria: this.categoria(),
        precioMin: this.precioMin(),
        precioMax: this.precioMax(),
      });
    });
  }

  protected irA(numero: number): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { page: numero > 1 ? numero : null },
      queryParamsHandling: 'merge',
    });
  }

  protected buscar(valor: string): void {
    const termino = valor.trim();
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { busqueda: termino || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected alternarFiltros(): void {
    this.filtrosAbiertos.update((valor) => !valor);
  }

  protected aplicarFiltros(categoriaValor: string, precioMinValor: string, precioMaxValor: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {
        categoria: categoriaValor || null,
        precio_min: precioMinValor || null,
        precio_max: precioMaxValor || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected limpiarFiltros(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { categoria: null, precio_min: null, precio_max: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private async cargar(numero: number, busqueda: string, filtros: FiltrosProductos): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.catalogo.listar(numero, busqueda, filtros)));
      this.estado.set('ok');
    } catch {
      this.pagina.set(null);
      this.estado.set('error');
    }
  }
}
