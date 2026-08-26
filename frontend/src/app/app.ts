import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { CarritoService } from './core/services/carrito.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly carrito = inject(CarritoService);

  protected readonly anio = new Date().getFullYear();

  constructor() {
    // El carrito se carga al iniciar sesion y se limpia al cerrarla, sin que
    // cada pantalla tenga que acordarse de hacerlo.
    effect(() => {
      if (this.auth.estaAutenticado()) {
        void this.carrito.cargar().catch(() => undefined);
      } else {
        this.carrito.limpiar();
      }
    });
  }

  protected async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
