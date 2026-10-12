import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EstadoPedido, PaginaPedidos, Pedido, PedidoLista } from '../models/pedido';
import { PedidoApi, convertir } from './pedido.service';

export const TAMANO_PAGINA_PEDIDOS = 20;

type PedidoListaApi = Omit<PedidoLista, 'total'> & { total: string };
type PaginaPedidosApi = Omit<PaginaPedidos, 'results'> & { results: PedidoListaApi[] };

/** Panel administrativo de pedidos (FR-19): listar, ver el detalle y marcar como pagado. */
@Injectable({ providedIn: 'root' })
export class AdminPedidosService {
  private readonly http = inject(HttpClient);

  listar(pagina: number, estado: EstadoPedido | null = null): Observable<PaginaPedidos> {
    let params = new HttpParams().set('page', pagina).set('page_size', TAMANO_PAGINA_PEDIDOS);
    if (estado) {
      params = params.set('estado', estado);
    }

    return this.http
      .get<PaginaPedidosApi>('/api/pedidos/admin/', { params })
      .pipe(
        map((pagina) => ({
          ...pagina,
          results: pagina.results.map((fila) => ({ ...fila, total: Number(fila.total) })),
        })),
      );
  }

  obtener(id: number): Observable<Pedido> {
    return this.http.get<PedidoApi>(`/api/pedidos/admin/${id}/`).pipe(map(convertir));
  }

  marcarPagado(id: number): Observable<Pedido> {
    return this.http.post<PedidoApi>(`/api/pedidos/admin/${id}/marcar-pagado/`, {}).pipe(map(convertir));
  }
}
