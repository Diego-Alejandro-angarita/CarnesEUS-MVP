import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Categoria, ErroresPorCampo, ProductoNuevo } from '../admin-productos.service';

const CAMPOS = [
  'categoria',
  'nombre',
  'presentacion',
  'precio',
  'descripcion',
  'foto_url',
  'disponible',
] as const;

type Campo = (typeof CAMPOS)[number];

/**
 * Formulario de producto compartido por el alta (FR-03) y la edicion (FR-04).
 *
 * Solo se ocupa de recoger y validar los datos: quien lo usa decide a que
 * endpoint van y que hacer despues.
 */
@Component({
  selector: 'app-formulario-producto',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './formulario-producto.html',
  styleUrl: './formulario-producto.scss',
})
export class FormularioProducto {
  private readonly fb = inject(FormBuilder);

  readonly categorias = input.required<Categoria[]>();
  /** Valores de partida. Null deja el formulario en blanco (alta). */
  readonly valores = input<ProductoNuevo | null>(null);
  readonly enviando = input(false);
  readonly etiquetaEnvio = input('Guardar producto');
  readonly rutaCancelar = input('/productos');
  /** Cuerpo del 400 de DRF. Cada objeto nuevo se vuelca sobre los controles. */
  readonly erroresBackend = input<ErroresPorCampo>({});

  readonly guardar = output<ProductoNuevo>();

  /**
   * La aplicacion corre sin zone.js. El estado de los controles (touched,
   * errors) no es una signal, asi que refrescarlo depende de que algo mas
   * dispare la deteccion de cambios. Este contador avanza con cada evento del
   * formulario para que los errores se recalculen por si solos.
   */
  private readonly revision = signal(0);

  /** Errores del backend que no corresponden a ningun campo del formulario. */
  protected readonly errorGeneral = signal('');

  protected readonly formulario: FormGroup = this.fb.group({
    categoria: [null as number | null, Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    presentacion: ['', [Validators.required, Validators.maxLength(60)]],
    precio: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: [''],
    foto_url: ['', Validators.pattern(/^https?:\/\/\S+$/)],
    disponible: [true],
  });

  /** Mensaje a mostrar bajo cada campo, o nada si el campo esta bien. */
  protected readonly errores = computed<Partial<Record<Campo, string>>>(() => {
    this.revision();

    const salida: Partial<Record<Campo, string>> = {};
    for (const campo of CAMPOS) {
      const control = this.formulario.controls[campo];
      if (control.touched && control.errors) {
        salida[campo] = mensajeDeError(campo, control.errors);
      }
    }
    return salida;
  });

  constructor() {
    this.formulario.events
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.revision.update((numero) => numero + 1));

    effect(() => {
      const valores = this.valores();
      if (valores) {
        this.formulario.reset(valores);
      }
    });

    effect(() => this.volcarErrores(this.erroresBackend()));
  }

  protected enviar(): void {
    this.errorGeneral.set('');
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      return;
    }

    this.guardar.emit(this.leer());
  }

  /** Deja el formulario como estaba al abrirlo. */
  limpiar(): void {
    this.errorGeneral.set('');
    this.formulario.reset(
      this.valores() ?? { categoria: null, disponible: true, descripcion: '', foto_url: '' },
    );
  }

  private leer(): ProductoNuevo {
    const crudos = this.formulario.getRawValue();
    return {
      categoria: Number(crudos.categoria),
      nombre: (crudos.nombre ?? '').trim(),
      descripcion: (crudos.descripcion ?? '').trim(),
      presentacion: (crudos.presentacion ?? '').trim(),
      precio: Number(crudos.precio),
      foto_url: (crudos.foto_url ?? '').trim(),
      disponible: Boolean(crudos.disponible),
    };
  }

  private volcarErrores(porCampo: ErroresPorCampo): void {
    const sueltos: string[] = [];

    for (const [campo, mensajes] of Object.entries(porCampo)) {
      const texto = mensajes.join(' ');
      const control = this.formulario.get(campo);
      if (control) {
        control.markAsTouched();
        control.setErrors({ ...(control.errors ?? {}), backend: texto });
      } else {
        sueltos.push(texto);
      }
    }

    this.errorGeneral.set(sueltos.join(' '));
  }
}

function mensajeDeError(campo: Campo, fallos: ValidationErrors): string {
  if (typeof fallos['backend'] === 'string') {
    return fallos['backend'];
  }
  if (fallos['required']) {
    return campo === 'categoria' ? 'Elige una categoria.' : 'Este campo es obligatorio.';
  }
  if (fallos['min']) {
    return 'El precio debe ser mayor que cero.';
  }
  if (fallos['maxlength']) {
    const maximo = (fallos['maxlength'] as { requiredLength: number }).requiredLength;
    return `Maximo ${maximo} caracteres.`;
  }
  if (fallos['pattern']) {
    return 'Escribe una direccion que empiece por http:// o https://.';
  }
  return 'Revisa este campo.';
}
