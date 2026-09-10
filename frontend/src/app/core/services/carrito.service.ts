import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Carrito, ItemCarrito } from '../models/carrito';

const CLAVE_TOKEN = 'carneseus.carrito.token';
const CABECERA_TOKEN = 'X-Carrito-Token';

type CarritoApi = Omit<Carrito, 'items' | 'total'> & {
  items: (Omit<ItemCarrito, 'precio' | 'subtotal'> & { precio: string; subtotal: string })[];
  total: string;
};

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly http = inject(HttpClient);

  /**
   * Un unico carrito compartido por toda la aplicacion: la cabecera y la pagina
   * del carrito leen la misma senal, asi el contador nunca queda desfasado.
   */
  private readonly estado = signal<Carrito | null>(null);

  readonly carrito = this.estado.asReadonly();
  readonly cantidad = computed(() => this.estado()?.cantidad_items ?? 0);
  readonly total = computed(() => this.estado()?.total ?? 0);

  async agregar(productoId: number, cantidad = 1): Promise<Carrito> {
    const respuesta = await firstValueFrom(
      this.http.post<CarritoApi>(
        '/api/carrito/items/',
        { producto: productoId, cantidad },
        { headers: this.cabeceras() },
      ),
    );
    return this.guardar(respuesta);
  }

  async cambiarCantidad(itemId: number, cantidad: number): Promise<Carrito> {
    const respuesta = await firstValueFrom(
      this.http.patch<CarritoApi>(
        `/api/carrito/items/${itemId}/`,
        { cantidad },
        { headers: this.cabeceras() },
      ),
    );
    return this.guardar(respuesta);
  }

  async quitar(itemId: number): Promise<Carrito> {
    const respuesta = await firstValueFrom(
      this.http.delete<CarritoApi>(`/api/carrito/items/${itemId}/`, {
        headers: this.cabeceras(),
      }),
    );
    return this.guardar(respuesta);
  }

  async refrescar(): Promise<Carrito> {
    const respuesta = await firstValueFrom(
      this.http.get<CarritoApi>('/api/carrito/', { headers: this.cabeceras() }),
    );
    return this.guardar(respuesta);
  }

  private cabeceras(): HttpHeaders {
    const token = this.leerToken();
    return token ? new HttpHeaders({ [CABECERA_TOKEN]: token }) : new HttpHeaders();
  }

  private guardar(api: CarritoApi): Carrito {
    const carrito = convertir(api);
    // El token identifica al visitante sin cuenta. Sin guardarlo, cada recarga
    // de la pagina le entregaria un carrito nuevo y vacio.
    this.escribirToken(carrito.token);
    this.estado.set(carrito);
    return carrito;
  }

  private leerToken(): string | null {
    try {
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      // Navegacion privada o cookies bloqueadas: el carrito sigue funcionando,
      // solo que dura lo que dure la pestana.
      return null;
    }
  }

  private escribirToken(token: string): void {
    try {
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      /* sin almacenamiento no hay nada que guardar */
    }
  }
}

function convertir(api: CarritoApi): Carrito {
  return {
    ...api,
    total: Number(api.total),
    items: api.items.map((item) => ({
      ...item,
      precio: Number(item.precio),
      subtotal: Number(item.subtotal),
    })),
  };
}