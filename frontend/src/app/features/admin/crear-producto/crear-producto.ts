import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AdminProductosService,
  Categoria,
  ErroresPorCampo,
  ProductoCreado,
  ProductoNuevo,
} from '../admin-productos.service';

type EstadoFormulario = 'cargando' | 'listo' | 'enviando' | 'creado' | 'error';

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

@Component({
  selector: 'app-crear-producto',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './crear-producto.html',
  styleUrl: './crear-producto.scss',
})
export class CrearProducto {
  private readonly admin = inject(AdminProductosService);
  private readonly fb = inject(FormBuilder);

  protected readonly estado = signal<EstadoFormulario>('cargando');
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly creado = signal<ProductoCreado | null>(null);
  /** Errores del backend que no corresponden a ningun campo del formulario. */
  protected readonly errorGeneral = signal('');

  /**
   * La aplicacion corre sin zone.js. El estado de los controles (touched,
   * errors) no es una signal, asi que refrescarlo depende de que algo mas
   * dispare la deteccion de cambios. Este contador avanza con cada evento del
   * formulario para que los errores se recalculen por si solos.
   */
  private readonly revision = signal(0);

  protected readonly enviando = computed(() => this.estado() === 'enviando');
  protected readonly hayCategorias = computed(() => this.categorias().length > 0);

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

  protected readonly formulario: FormGroup = this.fb.group({
    categoria: [null as number | null, Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    presentacion: ['', [Validators.required, Validators.maxLength(60)]],
    precio: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: [''],
    foto_url: ['', Validators.pattern(/^https?:\/\/\S+$/)],
    disponible: [true],
  });

  constructor() {
    this.formulario.events
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.revision.update((numero) => numero + 1));

    void this.cargarCategorias();
  }

  protected async enviar(): Promise<void> {
    this.errorGeneral.set('');
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      return;
    }

    this.estado.set('enviando');
    try {
      const producto = await firstValueFrom(this.admin.crear(this.valores()));
      this.creado.set(producto);
      this.estado.set('creado');
    } catch (error) {
      this.manejarError(error);
    }
  }

  /** Deja el formulario en blanco para dar de alta otro producto. */
  protected crearOtro(): void {
    this.formulario.reset({ categoria: null, disponible: true, descripcion: '', foto_url: '' });
    this.creado.set(null);
    this.errorGeneral.set('');
    this.estado.set('listo');
  }

  private valores(): ProductoNuevo {
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

  private async cargarCategorias(): Promise<void> {
    try {
      this.categorias.set(await firstValueFrom(this.admin.categorias()));
      this.estado.set('listo');
    } catch {
      this.estado.set('error');
    }
  }

  private manejarError(error: unknown): void {
    this.estado.set('listo');

    if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
      this.errorGeneral.set('No pudimos guardar el producto. Intentalo de nuevo.');
      return;
    }

    const porCampo = erroresDelBackend(error);
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

    if (sueltos.length > 0) {
      this.errorGeneral.set(sueltos.join(' '));
    } else if (Object.keys(porCampo).length === 0) {
      this.errorGeneral.set('El backend rechazo los datos. Revisa el formulario.');
    }
  }
}

function erroresDelBackend(respuesta: HttpErrorResponse): ErroresPorCampo {
  const cuerpo: unknown = respuesta.error;
  if (!cuerpo || typeof cuerpo !== 'object') {
    return {};
  }

  const salida: ErroresPorCampo = {};
  for (const [campo, valor] of Object.entries(cuerpo as Record<string, unknown>)) {
    salida[campo] = Array.isArray(valor) ? valor.map(String) : [String(valor)];
  }
  return salida;
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
