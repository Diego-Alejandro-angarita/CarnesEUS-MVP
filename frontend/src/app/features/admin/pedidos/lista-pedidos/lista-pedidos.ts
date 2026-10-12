import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstadoPedido, PaginaPedidos } from '../../../../core/models/pedido';
import { AdminPedidosService, TAMANO_PAGINA_PEDIDOS } from '../../../../core/services/admin-pedidos.service';

type EstadoPantalla = 'cargando' | 'ok' | 'error';

export const ETIQUETAS_ESTADO: Record<EstadoPedido, string> = {
  por_confirmar: 'Por confirmar',
  por_cobrar: 'Por cobrar',
  pagado: 'Pagado',
};

@Component({
  selector: 'app-lista-pedidos',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './lista-pedidos.html',
  styleUrl: './lista-pedidos.scss',
})
export class ListaPedidos {
  private readonly admin = inject(AdminPedidosService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly etiquetas = ETIQUETAS_ESTADO;

  readonly page = input(1, { transform: numberAttribute });
  readonly estado = input<EstadoPedido | null>(null);

  protected readonly estadoPantalla = signal<EstadoPantalla>('cargando');
  protected readonly pagina = signal<PaginaPedidos | null>(null);

  protected readonly paginaActual = computed(() => {
    const numero = this.page();
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1;
  });
  // El binding de inputs del router deja el input en undefined cuando el
  // query param sale de la URL: este computed es la unica fuente de verdad.
  protected readonly estadoFiltro = computed<EstadoPedido | null>(() => this.estado() ?? null);
  protected readonly pedidos = computed(() => this.pagina()?.results ?? []);
  protected readonly total = computed(() => this.pagina()?.count ?? 0);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA_PEDIDOS)),
  );
  protected readonly hayAnterior = computed(() => this.pagina()?.previous != null);
  protected readonly haySiguiente = computed(() => this.pagina()?.next != null);

  constructor() {
    effect(() => {
      void this.cargar(this.paginaActual(), this.estadoFiltro());
    });
  }

  protected irA(numero: number): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { page: numero > 1 ? numero : null },
      queryParamsHandling: 'merge',
    });
  }

  protected filtrarPorEstado(valor: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { estado: valor || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private async cargar(numero: number, estado: EstadoPedido | null): Promise<void> {
    this.estadoPantalla.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.admin.listar(numero, estado)));
      this.estadoPantalla.set('ok');
    } catch {
      this.pagina.set(null);
      this.estadoPantalla.set('error');
    }
  }
}
