import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { COMUNAS_MEDELLIN, CORREGIMIENTOS_MEDELLIN } from '../../core/data/comunas-medellin';
import { CarritoService } from '../../core/services/carrito.service';
import { ZonaEntregaService } from '../../core/services/zona-entrega.service';
import { CatalogoService, Producto } from '../catalogo/catalogo.service';

type EstadoFicha = 'cargando' | 'ok' | 'no-encontrado' | 'error';
type EstadoAgregar = 'listo' | 'enviando' | 'agregado' | 'error';

@Component({
  selector: 'app-ficha-producto',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './ficha-producto.html',
  styleUrl: './ficha-producto.scss',
})
export class FichaProducto {
  private readonly catalogo = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  protected readonly zona = inject(ZonaEntregaService);

  readonly slug = input.required<string>();

  protected readonly estado = signal<EstadoFicha>('cargando');
  protected readonly producto = signal<Producto | null>(null);
  protected readonly estadoAgregar = signal<EstadoAgregar>('listo');
  protected readonly cantidad = signal(1);

  protected readonly comunas = COMUNAS_MEDELLIN;
  protected readonly corregimientos = CORREGIMIENTOS_MEDELLIN;
  protected readonly pidiendoZona = signal(false);
  protected readonly comunaElegida = signal('');
  protected readonly verificandoZona = signal(false);
  protected readonly errorZona = signal('');

  constructor() {
    effect(() => {
      void this.cargar(this.slug());
    });
  }

  protected cambiarCantidad(delta: number): void {
    this.cantidad.update((actual) => Math.max(1, actual + delta));
  }

  protected async agregar(): Promise<void> {
    // Sin comuna elegida no agregamos todavia: primero se la pedimos.
    if (!this.zona.comuna()) {
      this.pidiendoZona.set(true);
      return;
    }
    await this.agregarAlCarrito();
  }

  protected async confirmarZona(): Promise<void> {
    const comuna = this.comunaElegida();
    if (!comuna) {
      this.errorZona.set('Elige tu comuna para continuar.');
      return;
    }

    this.errorZona.set('');
    this.verificandoZona.set(true);
    try {
      await this.zona.elegir(comuna);
    } catch {
      this.errorZona.set('No pudimos consultar la cobertura. Intentalo de nuevo.');
      return;
    } finally {
      this.verificandoZona.set(false);
    }

    // Solo avisamos: aunque no haya cobertura, el producto se agrega igual.
    this.pidiendoZona.set(false);
    await this.agregarAlCarrito();
  }

  private async agregarAlCarrito(): Promise<void> {
    const producto = this.producto();
    if (!producto) {
      return;
    }

    this.estadoAgregar.set('enviando');
    try {
      await this.carrito.agregar(producto.id, this.cantidad());
      this.estadoAgregar.set('agregado');
      this.cantidad.set(1);
      // El aviso de confirmacion se apaga solo: dejarlo fijo confunde si el
      // visitante agrega otro producto despues.
      setTimeout(() => {
        if (this.estadoAgregar() === 'agregado') {
          this.estadoAgregar.set('listo');
        }
      }, 3000);
    } catch {
      this.estadoAgregar.set('error');
    }
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