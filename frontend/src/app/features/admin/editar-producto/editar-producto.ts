import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AdminProductosService,
  Categoria,
  ErroresPorCampo,
  ProductoAdmin,
  ProductoNuevo,
} from '../admin-productos.service';
import { FormularioProducto } from '../formulario-producto/formulario-producto';
import { erroresDelBackend } from '../errores-backend';

type EstadoPantalla = 'cargando' | 'listo' | 'enviando' | 'guardado' | 'error' | 'no-encontrado';

@Component({
  selector: 'app-editar-producto',
  imports: [FormularioProducto, RouterLink],
  templateUrl: './editar-producto.html',
  styleUrl: './editar-producto.scss',
})
export class EditarProducto {
  private readonly admin = inject(AdminProductosService);

  /** Id del producto, tomado de la ruta /admin/productos/:id/editar. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly producto = signal<ProductoAdmin | null>(null);
  protected readonly erroresBackend = signal<ErroresPorCampo>({});
  protected readonly errorGeneral = signal('');

  protected readonly enviando = computed(() => this.estado() === 'enviando');

  /** El formulario trabaja con el precio como numero; la API lo manda en texto. */
  protected readonly valores = computed<ProductoNuevo | null>(() => {
    const producto = this.producto();
    if (!producto) {
      return null;
    }

    return {
      categoria: producto.categoria,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      presentacion: producto.presentacion,
      precio: Number(producto.precio),
      foto_url: producto.foto_url,
      disponible: producto.disponible,
    };
  });

  constructor() {
    effect(() => void this.cargar(this.id()));
  }

  protected async guardar(cambios: ProductoNuevo): Promise<void> {
    this.errorGeneral.set('');
    this.estado.set('enviando');

    try {
      this.producto.set(await firstValueFrom(this.admin.actualizar(this.id(), cambios)));
      this.estado.set('guardado');
    } catch (error) {
      this.estado.set('listo');
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.erroresBackend.set(erroresDelBackend(error));
      } else {
        this.errorGeneral.set('No pudimos guardar los cambios. Intentalo de nuevo.');
      }
    }
  }

  /** Vuelve al formulario tras confirmar, por si hay que seguir ajustando. */
  protected seguirEditando(): void {
    this.erroresBackend.set({});
    this.estado.set('listo');
  }

  private async cargar(id: number): Promise<void> {
    this.estado.set('cargando');
    try {
      const [categorias, producto] = await Promise.all([
        firstValueFrom(this.admin.categorias()),
        firstValueFrom(this.admin.obtener(id)),
      ]);
      this.categorias.set(categorias);
      this.producto.set(producto);
      this.estado.set('listo');
    } catch (error) {
      this.estado.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'no-encontrado' : 'error',
      );
    }
  }
}
