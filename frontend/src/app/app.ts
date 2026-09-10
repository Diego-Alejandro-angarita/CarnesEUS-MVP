import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { CarritoService } from './core/services/carrito.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly carrito = inject(CarritoService);

  protected readonly cantidadCarrito = this.carrito.cantidad;

  constructor() {
    // Se pide al arrancar para que el contador muestre lo que el visitante
    // dejo en el carrito la ultima vez que entro.
    void this.carrito.refrescar().catch(() => undefined);
  }
}