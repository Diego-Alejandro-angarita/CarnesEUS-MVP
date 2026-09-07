import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

/** Lo que viaja al backend al dar de alta un producto (FR-03). */
export interface ProductoNuevo {
  categoria: number;
  nombre: string;
  descripcion: string;
  presentacion: string;
  precio: number;
  foto_url: string;
  disponible: boolean;
}

/**
 * Respuesta del POST. No es el mismo contrato que el catalogo publico: aqui la
 * categoria vuelve como id mas su nombre, y el slug lo calcula el backend.
 */
export interface ProductoCreado extends Omit<ProductoNuevo, 'precio'> {
  id: number;
  slug: string;
  precio: string;
  categoria_nombre: string;
}

/** Errores por campo que devuelve DRF en un 400. */
export type ErroresPorCampo = Record<string, string[]>;

@Injectable({ providedIn: 'root' })
export class AdminProductosService {
  private readonly http = inject(HttpClient);

  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>('/api/categorias/');
  }

  crear(producto: ProductoNuevo): Observable<ProductoCreado> {
    return this.http.post<ProductoCreado>('/api/productos/', producto);
  }
}
