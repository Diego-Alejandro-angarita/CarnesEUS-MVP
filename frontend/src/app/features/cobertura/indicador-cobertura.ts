import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZonaCobertura } from '../../core/models/cobertura';
import { CoberturaService } from '../../core/services/cobertura.service';

type EstadoCobertura = 'inicial' | 'consultando' | 'cubierta' | 'sin-cobertura' | 'error';

let contador = 0;

/**
 * Indicador de zona de cobertura (FR-15).
 *
 * El cliente escribe municipio y barrio y el indicador le dice si hay
 * domicilios. Sirve solo (pagina /cobertura) o incrustado en otro formulario,
 * por ejemplo la direccion de entrega del checkout:
 *
 *   <app-indicador-cobertura
 *     [municipio]="direccion.municipio"
 *     [barrio]="direccion.barrio"
 *     (resultado)="hayCobertura.set($event)"
 *   />
 */
@Component({
  selector: 'app-indicador-cobertura',
  imports: [ReactiveFormsModule],
  templateUrl: './indicador-cobertura.html',
  styleUrl: './indicador-cobertura.scss',
})
export class IndicadorCobertura {
  private readonly fb = inject(FormBuilder);
  private readonly cobertura = inject(CoberturaService);

  /** Valores iniciales cuando el componente va dentro de otro formulario. */
  readonly municipio = input('');
  readonly barrio = input('');

  /** Avisa al padre si el barrio consultado esta (true) o no (false) cubierto. */
  readonly resultado = output<boolean>();

  /** Evita ids repetidos si hay mas de un indicador en la misma pantalla. */
  protected readonly uid = ++contador;

  protected readonly estado = signal<EstadoCobertura>('inicial');
  protected readonly mensaje = signal('');
  protected readonly zonas = signal<ZonaCobertura[]>([]);

  protected readonly formulario = this.fb.nonNullable.group({
    municipio: ['', Validators.required],
    barrio: ['', Validators.required],
  });

  private readonly municipioEscrito = toSignal(this.formulario.controls.municipio.valueChanges, {
    initialValue: '',
  });

  protected readonly municipiosSugeridos = computed(() =>
    [...new Set(this.zonas().map((zona) => zona.municipio))].sort(),
  );

  /** Barrios del municipio escrito; si todavia no hay municipio, todos. */
  protected readonly barriosSugeridos = computed(() => {
    const municipio = normalizar(this.municipioEscrito());
    return this.zonas()
      .filter((zona) => !municipio || normalizar(zona.municipio) === municipio)
      .map((zona) => zona.barrio)
      .sort();
  });

  constructor() {
    effect(() => {
      this.formulario.patchValue({ municipio: this.municipio(), barrio: this.barrio() });
    });

    // Si el cliente cambia el barrio, el resultado anterior ya no vale: se
    // quita para no dejar un "Si llegamos" pegado a otra direccion.
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.estado() !== 'consultando') {
        this.estado.set('inicial');
      }
    });

    // Las sugerencias son una comodidad: si fallan, el formulario sigue sirviendo.
    this.cobertura.zonas().subscribe({
      next: (zonas) => this.zonas.set(zonas),
      error: () => this.zonas.set([]),
    });
  }

  protected verificar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { municipio, barrio } = this.formulario.getRawValue();
    this.estado.set('consultando');

    this.cobertura.verificar(municipio, barrio).subscribe({
      next: (respuesta) => {
        this.mensaje.set(respuesta.mensaje);
        this.estado.set(respuesta.cubierta ? 'cubierta' : 'sin-cobertura');
        this.resultado.emit(respuesta.cubierta);
      },
      error: () => {
        this.mensaje.set('No pudimos consultar la cobertura. Intentalo de nuevo.');
        this.estado.set('error');
      },
    });
  }
}

/** Igual que en el backend: sin tildes ni mayusculas, para comparar sugerencias. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}