import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const TAMANO_PAGINA_PROMOCIONES = 20;

/** Lo que viaja al backend al crear o modificar una promocion (FR-13). */
export interface PromocionNueva {
  nombre: string;
  porcentaje: number;
  /** Fechas en formato AAAA-MM-DD, ambas incluidas. */
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  productos: number[];
}

export type EstadoPromocion = 'vigente' | 'programada' | 'vencida' | 'inactiva';

export interface Promocion extends PromocionNueva {
  id: number;
  productos_detalle: { id: number; nombre: string }[];
  /** Como esta hoy segun el backend. */
  estado: EstadoPromocion;
}

export interface PaginaPromociones {
  count: number;
  next: string | null;
  previous: string | null;
  results: Promocion[];
}

/** Producto tal como lo ofrece el selector del formulario. */
export interface ProductoOpcion {
  id: number;
  nombre: string;
  categoria: string;
  precio: string;
}

@Injectable({ providedIn: 'root' })
export class AdminPromocionesService {
  private readonly http = inject(HttpClient);

  listar(pagina: number): Observable<PaginaPromociones> {
    const params = new HttpParams().set('page', pagina).set('page_size', TAMANO_PAGINA_PROMOCIONES);
    return this.http.get<PaginaPromociones>('/api/promociones/', { params });
  }

  obtener(id: number): Observable<Promocion> {
    return this.http.get<Promocion>(`/api/promociones/${id}/`);
  }

  crear(promocion: PromocionNueva): Observable<Promocion> {
    return this.http.post<Promocion>('/api/promociones/', promocion);
  }

  actualizar(id: number, promocion: PromocionNueva): Observable<Promocion> {
    return this.http.patch<Promocion>(`/api/promociones/${id}/`, promocion);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`/api/promociones/${id}/`);
  }

  /** Todos los productos del catalogo, sin paginar, para elegir los de la promocion. */
  productos(): Observable<ProductoOpcion[]> {
    return this.http.get<ProductoOpcion[]>('/api/promociones/productos/');
  }
}
