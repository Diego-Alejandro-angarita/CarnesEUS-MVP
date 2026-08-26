import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensajes';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './auth.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly sesionExpirada = signal(
    this.ruta.snapshot.queryParamMap.get('expirada') === '1',
  );

  protected async enviar(): Promise<void> {
    this.error.set('');
    this.enviando.set(true);
    try {
      await this.auth.login(this.email, this.password);
      // Se vuelve a donde el usuario queria ir antes de que lo mandaran aqui.
      const destino = this.ruta.snapshot.queryParamMap.get('redirigir') ?? '/';
      await this.router.navigateByUrl(destino);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo iniciar sesion.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
