import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CatalogoService, PaginaProductos, TAMANO_PAGINA } from './catalogo.service';

type EstadoCatalogo = 'cargando' | 'ok' | 'error';

@Component({
  selector: 'app-catalogo',
  imports: [CurrencyPipe],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly page = input(1, { transform: numberAttribute });

  protected readonly estado = signal<EstadoCatalogo>('cargando');
  protected readonly pagina = signal<PaginaProductos | null>(null);

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
    effect(() => {
      void this.cargar(this.paginaActual());
    });
  }

  protected irA(numero: number): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { page: numero > 1 ? numero : null },
      queryParamsHandling: 'merge',
    });
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
