import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Pedido } from '../../../core/models/pedido';
import { AuthService } from '../../../core/services/auth.service';
import { PedidoService } from '../../../core/services/pedido.service';
import { ResumenPedido } from '../resumen-pedido/resumen-pedido';

type EstadoPantalla = 'cargando' | 'ok' | 'sin-sesion' | 'no-encontrado' | 'error';

/** Un pedido del cliente con sesion y en que va (FR-12). */
@Component({
  selector: 'app-detalle-mi-pedido',
  imports: [RouterLink, ResumenPedido],
  templateUrl: './detalle-mi-pedido.html',
  styleUrl: './detalle-mi-pedido.scss',
})
export class DetalleMiPedido {
  private readonly pedidos = inject(PedidoService);
  private readonly auth = inject(AuthService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly pedido = signal<Pedido | null>(null);

  constructor() {
    effect(() => {
      // Al entrar directo por la URL, la sesion se esta verificando todavia.
      if (this.auth.verificando()) {
        return;
      }
      if (!this.auth.usuario()) {
        this.estado.set('sin-sesion');
        return;
      }
      void this.cargar(this.id());
    });
  }

  private async cargar(id: number): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pedido.set(await firstValueFrom(this.pedidos.obtenerMio(id)));
      this.estado.set('ok');
    } catch (error) {
      this.estado.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'no-encontrado' : 'error',
      );
    }
  }
}
