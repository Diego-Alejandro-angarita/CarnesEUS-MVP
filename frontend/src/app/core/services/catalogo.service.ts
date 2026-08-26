import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { Categoria, FiltrosCatalogo, Pagina, Producto } from '../models';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  categorias() {
    return this.http.get<Categoria[]>('/api/categorias/');
  }

  /** FR-00/07/08: listado con busqueda, filtros y paginacion. */
  productos(filtros: FiltrosCatalogo = {}) {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      // Un filtro vacio no debe viajar: ensucia la URL y confunde al backend.
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Pagina<Producto>>('/api/productos/', { params });
  }

  /** FR-16: ficha del producto. */
  producto(slug: string) {
    return this.http.get<Producto>(`/api/productos/${slug}/`);
  }

  // --- Solo para el personal de la carniceria (FR-03/04/05/09) ---

  crear(datos: Partial<Producto>) {
    return this.http.post<Producto>('/api/productos/', datos);
  }

  actualizar(slug: string, datos: Partial<Producto>) {
    return this.http.patch<Producto>(`/api/productos/${slug}/`, datos);
  }

  eliminar(slug: string) {
    return this.http.delete<void>(`/api/productos/${slug}/`);
  }

  cambiarDisponibilidad(slug: string, disponible: boolean) {
    return this.http.patch<Producto>(`/api/productos/${slug}/disponibilidad/`, {
      disponible,
    });
  }
}
