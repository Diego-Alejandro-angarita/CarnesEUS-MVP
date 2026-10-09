import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ItemPedido, NuevoPedido, Pago, Pedido } from '../models/pedido';
import { CarritoService } from './carrito.service';

// La API devuelve los montos como texto ("77800.00"); aqui se pasan a numero.
type PedidoApi = Omit<Pedido, 'total' | 'items' | 'pago'> & {
  total: string;
  items: (Omit<ItemPedido, 'precio_unitario' | 'subtotal'> & {
    precio_unitario: string;
    subtotal: string;
  })[];
  pago: Omit<Pago, 'monto'> & { monto: string };
};

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly carrito = inject(CarritoService);

  /** Convierte el carrito actual en un pedido (FR-11). */
  crear(pedido: NuevoPedido): Observable<Pedido> {
    // El token identifica el carrito del visitante sin cuenta; con sesion
    // iniciada el backend lo ignora y usa el carrito del usuario.
    const token = this.carrito.carrito()?.token;
    const headers = token ? new HttpHeaders({ 'X-Carrito-Token': token }) : new HttpHeaders();

    return this.http.post<PedidoApi>('/api/pedidos/', pedido, { headers }).pipe(map(convertir));
  }
}

function convertir(api: PedidoApi): Pedido {
  return {
    ...api,
    total: Number(api.total),
    items: api.items.map((item) => ({
      ...item,
      precio_unitario: Number(item.precio_unitario),
      subtotal: Number(item.subtotal),
    })),
    pago: { ...api.pago, monto: Number(api.pago.monto) },
  };
}