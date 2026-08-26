import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { EstadoPedido, Pagina, Pedido } from '../models';

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly http = inject(HttpClient);

  /** El backend decide el alcance: el cliente ve los suyos, el staff todos. */
  lista(estado?: EstadoPedido) {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<Pagina<Pedido>>('/api/pedidos/', { params });
  }

  detalle(id: number) {
    return this.http.get<Pedido>(`/api/pedidos/${id}/`);
  }

  /** Convierte el carrito activo en un pedido con los precios congelados. */
  crear(direccionId: number, notas = '') {
    return this.http.post<Pedido>('/api/pedidos/', {
      direccion: direccionId,
      notas,
    });
  }

  /** FR-12: solo el personal de la carniceria. */
  cambiarEstado(id: number, estado: EstadoPedido) {
    return this.http.patch<Pedido>(`/api/pedidos/${id}/estado/`, { estado });
  }
}
