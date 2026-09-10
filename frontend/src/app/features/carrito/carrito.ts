import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CarritoService } from '../../core/services/carrito.service';

type EstadoCarrito = 'cargando' | 'ok' | 'error';

@Component({
  selector: 'app-carrito',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.scss',
})
export class CarritoPagina {
  private readonly carritoServicio = inject(CarritoService);

  protected readonly estado = signal<EstadoCarrito>('cargando');
  /** Id del item que se esta actualizando, para deshabilitar solo esa fila. */
  protected readonly ocupado = signal<number | null>(null);

  protected readonly carrito = this.carritoServicio.carrito;
  protected readonly items = computed(() => this.carrito()?.items ?? []);
  protected readonly total = this.carritoServicio.total;
  protected readonly hayAgotados = computed(() =>
    this.items().some((item) => !item.comprable),
  );

  constructor() {
    void this.cargar();
  }

  protected async cambiar(itemId: number, cantidad: number): Promise<void> {
    if (cantidad < 1) {
      return;
    }
    this.ocupado.set(itemId);
    try {
      await this.carritoServicio.cambiarCantidad(itemId, cantidad);
    } catch {
      this.estado.set('error');
    } finally {
      this.ocupado.set(null);
    }
  }

  protected async quitar(itemId: number): Promise<void> {
    this.ocupado.set(itemId);
    try {
      await this.carritoServicio.quitar(itemId);
    } catch {
      this.estado.set('error');
    } finally {
      this.ocupado.set(null);
    }
  }

  private async cargar(): Promise<void> {
    this.estado.set('cargando');
    try {
      await this.carritoServicio.refrescar();
      this.estado.set('ok');
    } catch {
      this.estado.set('error');
    }
  }
}