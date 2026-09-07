import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

/** Lo que viaja al backend al dar de alta (FR-03) o modificar (FR-04) un producto. */
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
 * Producto tal como lo ve la administracion. No es el mismo contrato que el
 * catalogo publico: aqui la categoria viaja como id mas su nombre, y el precio
 * llega como texto decimal.
 */
export interface ProductoAdmin extends Omit<ProductoNuevo, 'precio'> {
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

  crear(producto: ProductoNuevo): Observable<ProductoAdmin> {
    return this.http.post<ProductoAdmin>('/api/productos/', producto);
  }

  obtener(id: number): Observable<ProductoAdmin> {
    return this.http.get<ProductoAdmin>(`/api/productos/${id}/`);
  }

  actualizar(id: number, producto: ProductoNuevo): Observable<ProductoAdmin> {
    return this.http.patch<ProductoAdmin>(`/api/productos/${id}/`, producto);
  }
}
