import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ClientesSegmentados,
  FilaVenta,
  ResumenVentas,
  Sugerencias,
  VentasProductos,
} from '../models/estadisticas';

const numerar = (fila: FilaVenta): FilaVenta => ({
  ...fila,
  ingresos: fila.ingresos != null ? Number(fila.ingresos) : undefined,
  total: fila.total != null ? Number(fila.total) : undefined,
});

/** Estadisticas de ventas y sugerencias con IA (FR-06). Solo para el personal. */
@Injectable({ providedIn: 'root' })
export class AdminEstadisticasService {
  private readonly http = inject(HttpClient);

  private rango(desde: string, hasta: string): HttpParams {
    return new HttpParams().set('desde', desde).set('hasta', hasta);
  }

  resumen(desde: string, hasta: string): Observable<ResumenVentas> {
    return this.http
      .get<ResumenVentas>('/api/estadisticas/resumen/', { params: this.rango(desde, hasta) })
      .pipe(map((r) => ({
        ...r,
        total_vendido: Number(r.total_vendido),
        ticket_promedio: Number(r.ticket_promedio),
        ventas_por_dia: r.ventas_por_dia.map((d) => ({ ...d, total: Number(d.total) })),
      })));
  }

  productos(desde: string, hasta: string): Observable<VentasProductos> {
    return this.http
      .get<VentasProductos>('/api/estadisticas/productos/', { params: this.rango(desde, hasta) })
      .pipe(map((p) => ({
        mas_vendidos: p.mas_vendidos.map(numerar),
        por_categoria: p.por_categoria.map(numerar),
        por_barrio: p.por_barrio.map(numerar),
        por_metodo_pago: p.por_metodo_pago.map(numerar),
      })));
  }

  clientes(): Observable<ClientesSegmentados> {
    return this.http.get<ClientesSegmentados>('/api/estadisticas/clientes/');
  }

  sugerencias(desde: string, hasta: string): Observable<Sugerencias> {
    return this.http.post<Sugerencias>('/api/estadisticas/sugerencias/', {}, {
      params: this.rango(desde, hasta),
    });
  }
}
