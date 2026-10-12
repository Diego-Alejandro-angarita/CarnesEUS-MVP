import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstadoPedido, Pedido } from '../../../../core/models/pedido';
import { AdminPedidosService } from '../../../../core/services/admin-pedidos.service';
import { ETIQUETAS_ESTADO } from '../lista-pedidos/lista-pedidos';

type EstadoPantalla = 'cargando' | 'ok' | 'no-encontrado' | 'error';

/** Para que el admin sepa que implica cada estado al elegirlo, sin enredarse. */
export const AYUDA_ESTADO: Record<EstadoPedido, string> = {
  por_confirmar: 'El cliente va a pagar por transferencia; falta verificar que llego.',
  por_cobrar: 'Se cobra contraentrega (QR o datafono) cuando se entregue el pedido.',
  pagado: 'El pago ya quedo confirmado.',
};

@Component({
  selector: 'app-detalle-pedido',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.scss',
})
export class DetallePedido {
  private readonly admin = inject(AdminPedidosService);

  protected readonly etiquetas = ETIQUETAS_ESTADO;
  protected readonly ayudaEstado = AYUDA_ESTADO;
  protected readonly ESTADOS: EstadoPedido[] = ['por_confirmar', 'por_cobrar', 'pagado'];

  readonly id = input.required({ transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly cambiando = signal(false);
  protected readonly errorAccion = signal('');

  constructor() {
    effect(() => void this.cargar(this.id()));
  }

  protected async cambiarEstado(nuevoEstado: EstadoPedido): Promise<void> {
    if (this.pedido()?.estado === nuevoEstado) {
      return;
    }

    this.errorAccion.set('');
    this.cambiando.set(true);
    try {
      this.pedido.set(await firstValueFrom(this.admin.cambiarEstado(this.id(), nuevoEstado)));
    } catch {
      this.errorAccion.set('No pudimos cambiar el estado del pedido. Intentalo de nuevo.');
    } finally {
      this.cambiando.set(false);
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
