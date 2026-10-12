import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Pedido } from '../../../../core/models/pedido';
import { AdminPedidosService } from '../../../../core/services/admin-pedidos.service';
import { ETIQUETAS_ESTADO } from '../lista-pedidos/lista-pedidos';

type EstadoPantalla = 'cargando' | 'ok' | 'no-encontrado' | 'error';

@Component({
  selector: 'app-detalle-pedido',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.scss',
})
export class DetallePedido {
  private readonly admin = inject(AdminPedidosService);

  protected readonly etiquetas = ETIQUETAS_ESTADO;

  readonly id = input.required({ transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly marcando = signal(false);
  protected readonly errorAccion = signal('');

  constructor() {
    effect(() => void this.cargar(this.id()));
  }

  protected async marcarPagado(): Promise<void> {
    this.errorAccion.set('');
    this.marcando.set(true);
    try {
      this.pedido.set(await firstValueFrom(this.admin.marcarPagado(this.id())));
    } catch {
      this.errorAccion.set('No pudimos marcar el pedido como pagado. Intentalo de nuevo.');
    } finally {
      this.marcando.set(false);
    }
  }

  private async cargar(id: number): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pedido.set(await firstValueFrom(this.admin.obtener(id)));
      this.estado.set('ok');
    } catch (error) {
      this.estado.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'no-encontrado' : 'error',
      );
    }
  }
}
