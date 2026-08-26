import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensajes';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './auth.scss',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected datos = {
    email: '',
    nombre_completo: '',
    telefono: '',
    password: '',
    password2: '',
  };
  protected readonly error = signal('');
  protected readonly enviando = signal(false);

  protected async enviar(): Promise<void> {
    this.error.set('');
    this.enviando.set(true);
    try {
      await this.auth.registro(this.datos);
      // El backend deja la sesion abierta: se entra directo a la tienda.
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo crear la cuenta.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
