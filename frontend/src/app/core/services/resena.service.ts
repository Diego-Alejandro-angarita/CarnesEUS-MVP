import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosResena, PaginaResenas, PuedeResenar, Resena } from '../models/resena';

export const TAMANO_PAGINA_RESENAS = 10;

@Injectable({ providedIn: 'root' })
export class ResenaService {
  private readonly http = inject(HttpClient);

  listar(slugProducto: string, pagina: number): Observable<PaginaResenas> {
    return this.http.get<PaginaResenas>(`/api/productos/${slugProducto}/resenas/`, {
      params: { page: pagina, page_size: TAMANO_PAGINA_RESENAS },
    });
  }

  /** Si hay sesion, si ya compro el producto y si ya lo reseño. */
  puedeResenar(slugProducto: string): Observable<PuedeResenar> {
    return this.http.get<PuedeResenar>(`/api/productos/${slugProducto}/resenas/puede-resenar/`);
  }

  crear(slugProducto: string, datos: DatosResena): Observable<Resena> {
    return this.http.post<Resena>(`/api/productos/${slugProducto}/resenas/`, datos);
  }

  editar(id: number, datos: DatosResena): Observable<Resena> {
    return this.http.patch<Resena>(`/api/resenas/${id}/`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`/api/resenas/${id}/`);
  }
}
