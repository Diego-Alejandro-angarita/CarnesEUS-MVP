import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PromocionNueva, ProductoOpcion } from '../admin-promociones.service';
import { ErroresPorCampo } from '../admin-productos.service';

const CAMPOS = [
  'nombre',
  'porcentaje',
  'fecha_inicio',
  'fecha_fin',
  'activa',
  'productos',
] as const;

type Campo = (typeof CAMPOS)[number];

/**
 * Formulario de promocion compartido por el alta y la edicion (FR-13).
 *
 * Como el de productos, solo recoge y valida: quien lo usa decide a que
 * endpoint van los datos y que hacer despues.
 */
@Component({
  selector: 'app-formulario-promocion',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './formulario-promocion.html',
  styleUrl: './formulario-promocion.scss',
})
export class FormularioPromocion {
  private readonly fb = inject(FormBuilder);

  readonly productos = input.required<ProductoOpcion[]>();
  /** Valores de partida. Null deja el formulario en blanco (alta). */
  readonly valores = input<PromocionNueva | null>(null);
  readonly enviando = input(false);
  readonly etiquetaEnvio = input('Guardar promocion');
  readonly rutaCancelar = input('/admin/promociones');
  /** Cuerpo del 400 de DRF. Cada objeto nuevo se vuelca sobre los controles. */
  readonly erroresBackend = input<ErroresPorCampo>({});

  readonly guardar = output<PromocionNueva>();

  /** Ver formulario-producto: la app corre sin zone.js y esto refresca los errores. */
  private readonly revision = signal(0);

  protected readonly errorGeneral = signal('');
  /** Texto para acotar la lista de productos por nombre o categoria. */
  protected readonly filtro = signal('');

  protected readonly formulario: FormGroup = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(120)]],
      porcentaje: [
        null as number | null,
        [Validators.required, Validators.min(1), Validators.max(99)],
      ],
      fecha_inicio: [hoy(), Validators.required],
      fecha_fin: ['', Validators.required],
      activa: [true],
      productos: [[] as number[], Validators.required],
    },
    { validators: fechasEnOrden },
  );

  protected readonly seleccionados = computed(() => {
    this.revision();
    return new Set<number>(this.formulario.controls['productos'].value as number[]);
  });

  protected readonly productosFiltrados = computed(() => {
    const texto = normalizar(this.filtro().trim());
    if (!texto) {
      return this.productos();
    }
    return this.productos().filter(
      (producto) =>
        normalizar(producto.nombre).includes(texto) ||
        normalizar(producto.categoria).includes(texto),
    );
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

    // El orden de las fechas es un error del grupo; se muestra bajo la de fin.
    const fin = this.formulario.controls['fecha_fin'];
    if (!salida.fecha_fin && fin.touched && this.formulario.errors?.['fechasAlReves']) {
      salida.fecha_fin = 'La fecha de fin no puede ser anterior a la de inicio.';
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

  protected alternar(id: number, marcado: boolean): void {
    const control = this.formulario.controls['productos'];
    const actuales = control.value as number[];
    control.setValue(marcado ? [...actuales, id] : actuales.filter((otro) => otro !== id));
    control.markAsTouched();
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
    this.filtro.set('');
    this.formulario.reset(
      this.valores() ?? {
        nombre: '',
        porcentaje: null,
        fecha_inicio: hoy(),
        fecha_fin: '',
        activa: true,
        productos: [],
      },
    );
  }

  private leer(): PromocionNueva {
    const crudos = this.formulario.getRawValue();
    return {
      nombre: (crudos.nombre ?? '').trim(),
      porcentaje: Number(crudos.porcentaje),
      fecha_inicio: crudos.fecha_inicio,
      fecha_fin: crudos.fecha_fin,
      activa: Boolean(crudos.activa),
      productos: [...(crudos.productos as number[])],
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

/** Fecha de hoy en la zona del navegador, como la espera un input de tipo date. */
function hoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Las fechas AAAA-MM-DD se pueden comparar como texto. */
function fechasEnOrden(grupo: AbstractControl): ValidationErrors | null {
  const inicio = grupo.get('fecha_inicio')?.value as string;
  const fin = grupo.get('fecha_fin')?.value as string;
  return inicio && fin && fin < inicio ? { fechasAlReves: true } : null;
}

/** Minusculas y sin tildes: "chicharron" encuentra "Chicharrón". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function mensajeDeError(campo: Campo, fallos: ValidationErrors): string {
  if (typeof fallos['backend'] === 'string') {
    return fallos['backend'];
  }
  if (fallos['required']) {
    if (campo === 'productos') {
      return 'Elige al menos un producto.';
    }
    if (campo === 'fecha_inicio' || campo === 'fecha_fin') {
      return 'Elige una fecha.';
    }
    return 'Este campo es obligatorio.';
  }
  if (fallos['min'] || fallos['max']) {
    return 'El descuento debe estar entre 1 y 99 por ciento.';
  }
  if (fallos['maxlength']) {
    const maximo = (fallos['maxlength'] as { requiredLength: number }).requiredLength;
    return `Maximo ${maximo} caracteres.`;
  }
  return 'Revisa este campo.';
}
