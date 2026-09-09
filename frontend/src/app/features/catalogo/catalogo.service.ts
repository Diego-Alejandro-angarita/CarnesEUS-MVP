import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export const TAMANO_PAGINA = 12;

export interface Producto {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  presentacion: string;
  precio: number;
  foto_url: string;
  disponible: boolean;
  categoria: string;
}

export interface PaginaProductos {
  count: number;
  next: string | null;
  previous: string | null;
  results: Producto[];
}

type ProductoApi = Omit<Producto, 'precio'> & { precio: string };
type PaginaProductosApi = Omit<PaginaProductos, 'results'> & { results: ProductoApi[] };

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  listar(pagina: number, busqueda = ''): Observable<PaginaProductos> {
    let params = new HttpParams().set('page', pagina).set('page_size', TAMANO_PAGINA);
    if (busqueda) {
      params = params.set('search', busqueda);
    }

    return this.http
      .get<PaginaProductosApi>('/api/productos/', { params })
      .pipe(map((pagina) => ({ ...pagina, results: pagina.results.map(convertir) })));
  }

  obtener(slug: string): Observable<Producto> {
    return this.http
      .get<ProductoApi>(`/api/productos/${slug}/`)
      .pipe(map(convertir));
  }
}

function convertir(producto: ProductoApi): Producto {
  return { ...producto, precio: Number(producto.precio) };
}
