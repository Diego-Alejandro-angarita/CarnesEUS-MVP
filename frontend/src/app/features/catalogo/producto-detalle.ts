import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/mensajes';
import { Producto } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-producto-detalle',
  imports: [FormsModule, RouterLink, PrecioCopPipe],
  templateUrl: './producto-detalle.html',
  styleUrl: './producto-detalle.scss',
})
export class ProductoDetalle {
  private readonly catalogo = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  protected readonly auth = inject(AuthService);

  /** Llega de la ruta gracias a withComponentInputBinding(). */
  readonly slug = input.required<string>();

  protected readonly producto = signal<Producto | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly agregado = signal(false);
  protected readonly agregando = signal(false);

  protected cantidad = '1.000';

  constructor() {
    // El input de ruta ya esta resuelto en el primer microtask.
    queueMicrotask(() => void this.cargar());
  }

  private async cargar(): Promise<void> {
    try {
      this.producto.set(await firstValueFrom(this.catalogo.producto(this.slug())));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No encontramos este producto.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async agregar(): Promise<void> {
    const producto = this.producto();
    if (!producto) {
      return;
    }

    this.agregando.set(true);
    this.error.set('');
    try {
      await this.carrito.agregar(producto.id, this.cantidad);
      this.agregado.set(true);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo agregar al carrito.'));
    } finally {
      this.agregando.set(false);
    }
  }
}
