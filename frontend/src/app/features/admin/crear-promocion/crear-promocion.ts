import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AdminPromocionesService,
  ProductoOpcion,
  Promocion,
  PromocionNueva,
} from '../admin-promociones.service';
import { ErroresPorCampo } from '../admin-productos.service';
import { erroresDelBackend } from '../errores-backend';
import { FormularioPromocion } from '../formulario-promocion/formulario-promocion';
import { esSinPermiso } from '../sin-permiso';

type EstadoPantalla = 'cargando' | 'listo' | 'enviando' | 'creado' | 'error' | 'sin-permiso';

@Component({
  selector: 'app-crear-promocion',
  imports: [FormularioPromocion, RouterLink],
  templateUrl: './crear-promocion.html',
  styleUrl: './crear-promocion.scss',
})
export class CrearPromocion {
  private readonly admin = inject(AdminPromocionesService);
  private readonly formulario = viewChild(FormularioPromocion);

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly productos = signal<ProductoOpcion[]>([]);
  protected readonly creada = signal<Promocion | null>(null);
  protected readonly erroresBackend = signal<ErroresPorCampo>({});
  protected readonly errorGeneral = signal('');

  protected readonly enviando = computed(() => this.estado() === 'enviando');
  protected readonly hayProductos = computed(() => this.productos().length > 0);

  constructor() {
    void this.cargarProductos();
  }

  protected async guardar(promocion: PromocionNueva): Promise<void> {
    this.errorGeneral.set('');
    this.estado.set('enviando');

    try {
      this.creada.set(await firstValueFrom(this.admin.crear(promocion)));
      this.estado.set('creado');
    } catch (error) {
      if (esSinPermiso(error)) {
        this.estado.set('sin-permiso');
        return;
      }
      this.estado.set('listo');
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.erroresBackend.set(erroresDelBackend(error));
      } else {
        this.errorGeneral.set('No pudimos guardar la promocion. Intentalo de nuevo.');
      }
    }
  }

  /** Deja el formulario en blanco para crear otra promocion. */
  protected crearOtra(): void {
    this.creada.set(null);
    this.erroresBackend.set({});
    this.errorGeneral.set('');
    this.estado.set('listo');
    this.formulario()?.limpiar();
  }

  private async cargarProductos(): Promise<void> {
    try {
      this.productos.set(await firstValueFrom(this.admin.productos()));
      this.estado.set('listo');
    } catch (error) {
      this.estado.set(esSinPermiso(error) ? 'sin-permiso' : 'error');
    }
  }
}
