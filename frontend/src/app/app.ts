import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.auth.verificarSesion();
  }

  protected salir(): void {
    this.auth.cerrarSesion().subscribe(() => {
      void this.router.navigateByUrl('/productos');
    });
  }
}
