import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  COMUNAS_MEDELLIN,
  CORREGIMIENTOS_MEDELLIN,
  MUNICIPIO_COBERTURA,
} from '../../core/data/comunas-medellin';
import { CoberturaService } from '../../core/services/cobertura.service';
import { ZonaEntregaService } from '../../core/services/zona-entrega.service';

type EstadoCobertura = 'inicial' | 'consultando' | 'cubierta' | 'sin-cobertura' | 'error';

let contador = 0;

@Component({
  selector: 'app-indicador-cobertura',
  imports: [ReactiveFormsModule],
  templateUrl: './indicador-cobertura.html',
  styleUrl: './indicador-cobertura.scss',
})
export class IndicadorCobertura {
  private readonly fb = inject(FormBuilder);
  private readonly cobertura = inject(CoberturaService);
  private readonly zona = inject(ZonaEntregaService);

  /** Comuna preseleccionada cuando el componente va dentro de otro formulario. */
  readonly barrio = input('');

  /** Avisa al padre si la zona consultada esta (true) o no (false) cubierta. */
  readonly resultado = output<boolean>();

  protected readonly uid = ++contador;

  protected readonly comunas = COMUNAS_MEDELLIN;
  protected readonly corregimientos = CORREGIMIENTOS_MEDELLIN;

  protected readonly estado = signal<EstadoCobertura>('inicial');
  protected readonly mensaje = signal('');

  protected readonly formulario = this.fb.nonNullable.group({
    comuna: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      // untracked: solo reaccionamos a `barrio`; si siguiera a la zona guardada,
      // el resultado recien consultado se borraria al instante.
      const recordada = untracked(() => this.zona.comuna());
      this.formulario.patchValue({ comuna: this.barrio() || recordada || '' });
    });

    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.estado() !== 'consultando') {
        this.estado.set('inicial');
      }
    });
  }

  protected get comunaInvalida(): boolean {
    const control = this.formulario.controls.comuna;
    return control.invalid && control.touched;
  }

  protected verificar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { comuna } = this.formulario.getRawValue();
    this.estado.set('consultando');

    this.cobertura.verificar(MUNICIPIO_COBERTURA, comuna).subscribe({
      next: (respuesta) => {
        this.mensaje.set(respuesta.mensaje);
        this.estado.set(respuesta.cubierta ? 'cubierta' : 'sin-cobertura');
        this.zona.recordar(comuna, respuesta.cubierta);
        this.resultado.emit(respuesta.cubierta);
      },
      error: () => {
        this.mensaje.set('No pudimos consultar la cobertura. Intentalo de nuevo.');
        this.estado.set('error');
      },
    });
  }
}