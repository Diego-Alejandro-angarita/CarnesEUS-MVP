import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { TutorialService } from '../../../core/tutorial/tutorial.service';
import { BotonTutorial } from '../../../shared/boton-tutorial/boton-tutorial';
import {
  AdminProductosService,
  Categoria,
  ErroresPorCampo,
  ProductoAdmin,
  ProductoNuevo,
} from '../admin-productos.service';
import { FormularioProducto } from '../formulario-producto/formulario-producto';
import { erroresDelBackend } from '../errores-backend';

type EstadoPantalla = 'cargando' | 'listo' | 'enviando' | 'creado' | 'error';

@Component({
  selector: 'app-crear-producto',
  imports: [FormularioProducto, RouterLink, BotonTutorial],
  templateUrl: './crear-producto.html',
  styleUrl: './crear-producto.scss',
})
export class CrearProducto {
  private readonly admin = inject(AdminProductosService);
  private readonly tutorial = inject(TutorialService);
  private readonly injector = inject(Injector);
  private readonly formulario = viewChild(FormularioProducto);

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly creado = signal<ProductoAdmin | null>(null);
  protected readonly erroresBackend = signal<ErroresPorCampo>({});
  protected readonly errorGeneral = signal('');

  protected readonly enviando = computed(() => this.estado() === 'enviando');
  protected readonly hayCategorias = computed(() => this.categorias().length > 0);

  constructor() {
    void this.cargarCategorias();

    effect(() => {
      if (this.estado() === 'listo' && this.hayCategorias()) {
        afterNextRender(() => this.tutorial.iniciarSiPendiente('admin.producto-formulario'), {
          injector: this.injector,
        });
      }
    });
  }

  protected async guardar(producto: ProductoNuevo): Promise<void> {
    this.errorGeneral.set('');
    this.estado.set('enviando');

    try {
      this.creado.set(await firstValueFrom(this.admin.crear(producto)));
      this.estado.set('creado');
    } catch (error) {
      this.estado.set('listo');
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.erroresBackend.set(erroresDelBackend(error));
      } else {
        this.errorGeneral.set('No pudimos guardar el producto. Intentalo de nuevo.');
      }
    }
  }

  /** Deja el formulario en blanco para dar de alta otro producto. */
  protected crearOtro(): void {
    this.creado.set(null);
    this.erroresBackend.set({});
    this.errorGeneral.set('');
    this.estado.set('listo');
    this.formulario()?.limpiar();
  }

  private async cargarCategorias(): Promise<void> {
    try {
      this.categorias.set(await firstValueFrom(this.admin.categorias()));
      this.estado.set('listo');
    } catch {
      this.estado.set('error');
    }
  }
}
