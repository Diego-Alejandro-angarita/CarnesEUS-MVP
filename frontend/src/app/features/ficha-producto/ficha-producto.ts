import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CatalogoService, Producto } from '../catalogo/catalogo.service';

type EstadoFicha = 'cargando' | 'ok' | 'no-encontrado' | 'error';

@Component({
  selector: 'app-ficha-producto',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './ficha-producto.html',
  styleUrl: './ficha-producto.scss',
})
export class FichaProducto {
  private readonly catalogo = inject(CatalogoService);

  readonly slug = input.required<string>();

  protected readonly estado = signal<EstadoFicha>('cargando');
  protected readonly producto = signal<Producto | null>(null);

  constructor() {
    effect(() => {
      void this.cargar(this.slug());
    });
  }

  private async cargar(slug: string): Promise<void> {
    this.estado.set('cargando');
    try {
      this.producto.set(await firstValueFrom(this.catalogo.obtener(slug)));
      this.estado.set('ok');
    } catch (error: unknown) {
      this.producto.set(null);
      const esNoEncontrado = error instanceof HttpErrorResponse && error.status === 404;
      this.estado.set(esNoEncontrado ? 'no-encontrado' : 'error');
    }
  }
}
