import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensajes';
import { ItemCarrito } from '../../core/models';
import { CarritoService } from '../../core/services/carrito.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-carrito',
  imports: [RouterLink, PrecioCopPipe],
  templateUrl: './carrito.html',
  styleUrl: './carrito.scss',
})
export class CarritoPagina {
  protected readonly carritoService = inject(CarritoService);

  protected readonly carrito = this.carritoService.carrito;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly ocupado = signal<number | null>(null);

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      await this.carritoService.cargar();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar el carrito.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async cambiar(item: ItemCarrito, delta: number): Promise<void> {
    const nueva = Number(item.cantidad) + delta;
    if (nueva <= 0) {
      await this.quitar(item);
      return;
    }
    await this.ejecutar(item.id, () =>
      this.carritoService.cambiarCantidad(item.id, nueva.toFixed(3)),
    );
  }

  protected async quitar(item: ItemCarrito): Promise<void> {
    await this.ejecutar(item.id, () => this.carritoService.quitar(item.id));
  }

  protected async vaciar(): Promise<void> {
    await this.ejecutar(-1, () => this.carritoService.vaciar());
  }

  /** Un solo lugar para el estado de "ocupado" y el manejo de errores. */
  private async ejecutar(id: number, accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(id);
    this.error.set('');
    try {
      await accion();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo actualizar el carrito.'));
    } finally {
      this.ocupado.set(null);
    }
  }
}
