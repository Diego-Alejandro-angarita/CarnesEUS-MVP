import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/mensajes';
import { Pedido } from '../../core/models';
import { PagosService } from '../../core/services/pagos.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-pedido-detalle',
  imports: [DatePipe, RouterLink, PrecioCopPipe],
  templateUrl: './pedido-detalle.html',
  styleUrl: './pedido-detalle.scss',
})
export class PedidoDetalle {
  private readonly servicio = inject(PedidosService);
  private readonly pagos = inject(PagosService);

  readonly id = input.required<string>();

  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly reintentando = signal(false);

  constructor() {
    queueMicrotask(() => void this.cargar());
  }

  private async cargar(): Promise<void> {
    try {
      this.pedido.set(await firstValueFrom(this.servicio.detalle(Number(this.id()))));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No encontramos este pedido.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Vuelve a consultarle a Wompi el estado del pago.
   *
   * Es lo que salva el flujo en desarrollo: Wompi no puede alcanzar localhost,
   * asi que el webhook no llega y el pedido se quedaria pendiente para siempre.
   */
  protected async verificarPago(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido) {
      return;
    }

    this.reintentando.set(true);
    this.error.set('');
    try {
      const resultado = await this.pagos.verificar(pedido.id, null);
      this.pedido.set(resultado.pedido);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo verificar el pago.'));
    } finally {
      this.reintentando.set(false);
    }
  }
}
