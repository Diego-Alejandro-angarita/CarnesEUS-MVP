import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { LoginService } from '../../core/services/login.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly loginService = inject(LoginService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorGeneral.set(null);

    this.loginService.iniciarSesion(this.formulario.getRawValue()).subscribe({
      next: () => {
        this.router.navigateByUrl('/productos');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.errorGeneral.set(this.mensajeDeError(error));
      },
    });
  }

  private mensajeDeError(error: HttpErrorResponse): string {
    const datos = error.error as { non_field_errors?: string[] } | undefined;
    if (datos?.non_field_errors?.length) {
      return datos.non_field_errors[0];
    }
    return 'No se pudo iniciar sesion. Intenta de nuevo.';
  }
}
