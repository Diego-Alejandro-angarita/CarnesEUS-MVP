import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RegistroService } from '../../core/services/registro.service';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly registroService = inject(RegistroService);

  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly exito = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    password: ['', Validators.required],
    password_confirmacion: ['', Validators.required],
  });

  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorGeneral.set(null);

    this.registroService.registrar(this.formulario.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.exito.set(true);
        this.formulario.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.errorGeneral.set(this.mensajeDeError(error));
      },
    });
  }

  private mensajeDeError(error: HttpErrorResponse): string {
    const datos = error.error as Record<string, string[]> | undefined;
    if (datos) {
      const primerCampo = Object.values(datos)[0];
      if (Array.isArray(primerCampo) && primerCampo.length > 0) {
        return primerCampo[0];
      }
    }
    return 'No se pudo completar el registro. Intenta de nuevo.';
  }
}
