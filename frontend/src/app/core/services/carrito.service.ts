import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Carrito } from '../models';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly http = inject(HttpClient);

  private readonly _carrito = signal<Carrito | null>(null);
  readonly carrito = this._carrito.asReadonly();

  /** Para el contador del encabezado. */
  readonly cantidadItems = computed(() => this._carrito()?.items.length ?? 0);
  readonly subtotal = computed(() => Number(this._carrito()?.subtotal ?? 0));

  async cargar(): Promise<void> {
    const carrito = await firstValueFrom(this.http.get<Carrito>('/api/carrito/'));
    this._carrito.set(carrito);
  }

  async agregar(productoId: number, cantidad: string): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/carrito/items/', { producto: productoId, cantidad }),
    );
    await this.cargar();
  }

  async cambiarCantidad(itemId: number, cantidad: string): Promise<void> {
    await firstValueFrom(this.http.patch(`/api/carrito/items/${itemId}/`, { cantidad }));
    await this.cargar();
  }

  async quitar(itemId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/carrito/items/${itemId}/`));
    await this.cargar();
  }

  async vaciar(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/carrito/'));
    await this.cargar();
  }

  /** Al cerrar sesion el carrito en memoria deja de tener sentido. */
  limpiar(): void {
    this._carrito.set(null);
  }
}
