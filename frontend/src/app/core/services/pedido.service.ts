import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ItemPedido,
  NuevoPedido,
  Pago,
  PaginaPedidosCliente,
  Pedido,
  PedidoCliente,
} from '../models/pedido';
import { CarritoService } from './carrito.service';

// La API devuelve los montos como texto ("77800.00"); aqui se pasan a numero.
// Se exporta para que el panel administrativo (admin-pedidos.service) reuse
// la misma conversion al pedir el detalle de un pedido.
export type PedidoApi = Omit<Pedido, 'total' | 'items' | 'pago'> & {
  total: string;
  items: (Omit<ItemPedido, 'precio_unitario' | 'subtotal'> & {
    precio_unitario: string;
    subtotal: string;
  })[];
  pago: Omit<Pago, 'monto'> & { monto: string };
};

export const TAMANO_PAGINA_MIS_PEDIDOS = 10;

type PaginaPedidosClienteApi = Omit<PaginaPedidosCliente, 'results'> & {
  results: (Omit<PedidoCliente, 'total'> & { total: string })[];
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

  /** Pedidos del cliente con sesion iniciada (FR-12). */
  misPedidos(pagina: number): Observable<PaginaPedidosCliente> {
    const params = new HttpParams().set('page', pagina).set('page_size', TAMANO_PAGINA_MIS_PEDIDOS);
    return this.http.get<PaginaPedidosClienteApi>('/api/pedidos/mios/', { params }).pipe(
      map((pagina) => ({
        ...pagina,
        results: pagina.results.map((fila) => ({ ...fila, total: Number(fila.total) })),
      })),
    );
  }

  /** Uno de los pedidos del cliente con sesion, con su seguimiento. */
  obtenerMio(id: number): Observable<Pedido> {
    return this.http.get<PedidoApi>(`/api/pedidos/mios/${id}/`).pipe(map(convertir));
  }

  /**
   * Para quien compro sin cuenta: el pedido si el numero y el correo coinciden.
   * Va por POST para que el correo no quede en la URL.
   */
  consultar(numero: number, email: string): Observable<Pedido> {
    return this.http
      .post<PedidoApi>('/api/pedidos/consultar/', { numero, email })
      .pipe(map(convertir));
  }
}

export function convertir(api: PedidoApi): Pedido {
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