import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { CarritoService } from './core/services/carrito.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoService);

  protected readonly cantidadCarrito = this.carrito.cantidad;

  constructor() {
    this.auth.verificarSesion();
    // Se pide al arrancar para que el contador muestre lo que el visitante
    // dejo en el carrito la ultima vez que entro.
    void this.carrito.refrescar().catch(() => undefined);
  }

  protected salir(): void {
    this.auth.cerrarSesion().subscribe(() => {
      // Al salir, el carrito del usuario deja de ser el suyo: se vuelve a
      // pedir para que la cabecera muestre el del visitante anonimo.
      void this.carrito.refrescar().catch(() => undefined);
      void this.router.navigateByUrl('/productos');
    });
  }
}