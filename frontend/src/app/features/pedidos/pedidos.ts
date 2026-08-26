import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/mensajes';
import { Pedido } from '../../core/models';
import { PedidosService } from '../../core/services/pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-pedidos',
  imports: [DatePipe, RouterLink, PrecioCopPipe],
  templateUrl: './pedidos.html',
  styleUrl: './pedidos.scss',
})
export class Pedidos {
  private readonly servicio = inject(PedidosService);

  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const pagina = await firstValueFrom(this.servicio.lista());
      this.pedidos.set(pagina.results);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudieron cargar tus pedidos.'));
    } finally {
      this.cargando.set(false);
    }
  }
}
