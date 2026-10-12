import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
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

type EstadoPantalla =
  'cargando' | 'listo' | 'enviando' | 'guardado' | 'error' | 'no-encontrado' | 'sin-permiso';

@Component({
  selector: 'app-editar-promocion',
  imports: [FormularioPromocion, RouterLink],
  templateUrl: './editar-promocion.html',
  styleUrl: './editar-promocion.scss',
})
export class EditarPromocion {
  private readonly admin = inject(AdminPromocionesService);

  /** Id de la promocion, tomado de la ruta /admin/promociones/:id/editar. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly productos = signal<ProductoOpcion[]>([]);
  protected readonly promocion = signal<Promocion | null>(null);
  protected readonly erroresBackend = signal<ErroresPorCampo>({});
  protected readonly errorGeneral = signal('');

  protected readonly enviando = computed(() => this.estado() === 'enviando');

  protected readonly valores = computed<PromocionNueva | null>(() => {
    const promocion = this.promocion();
    if (!promocion) {
      return null;
    }

    // Un producto eliminado del catalogo despues de crear la promocion ya no se
    // ofrece en el selector; si se reenviara, el backend rechazaria el cambio.
    const ofrecidos = new Set(this.productos().map((producto) => producto.id));
    return {
      nombre: promocion.nombre,
      porcentaje: promocion.porcentaje,
      fecha_inicio: promocion.fecha_inicio,
      fecha_fin: promocion.fecha_fin,
      activa: promocion.activa,
      productos: promocion.productos.filter((id) => ofrecidos.has(id)),
    };
  });

  constructor() {
    effect(() => void this.cargar(this.id()));
  }

  protected async guardar(cambios: PromocionNueva): Promise<void> {
    this.errorGeneral.set('');
    this.estado.set('enviando');

    try {
      this.promocion.set(await firstValueFrom(this.admin.actualizar(this.id(), cambios)));
      this.estado.set('guardado');
    } catch (error) {
      if (esSinPermiso(error)) {
        this.estado.set('sin-permiso');
        return;
      }
      this.estado.set('listo');
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.erroresBackend.set(erroresDelBackend(error));
      } else {
        this.errorGeneral.set('No pudimos guardar los cambios. Intentalo de nuevo.');
      }
    }
  }

  /** Vuelve al formulario tras confirmar, por si hay que seguir ajustando. */
  protected seguirEditando(): void {
    this.erroresBackend.set({});
    this.estado.set('listo');
  }

  private async cargar(id: number): Promise<void> {
    this.estado.set('cargando');
    try {
      const [productos, promocion] = await Promise.all([
        firstValueFrom(this.admin.productos()),
        firstValueFrom(this.admin.obtener(id)),
      ]);
      this.productos.set(productos);
      this.promocion.set(promocion);
      this.estado.set('listo');
    } catch (error) {
      if (esSinPermiso(error)) {
        this.estado.set('sin-permiso');
      } else if (error instanceof HttpErrorResponse && error.status === 404) {
        this.estado.set('no-encontrado');
      } else {
        this.estado.set('error');
      }
    }
  }
}
