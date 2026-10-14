import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ClientesSegmentados,
  ResumenVentas,
  Sugerencias,
  VentasProductos,
} from '../../../core/models/estadisticas';
import { AdminEstadisticasService } from '../../../core/services/admin-estadisticas.service';

type EstadoPantalla = 'cargando' | 'ok' | 'error';

/** Fecha local en AAAA-MM-DD (toISOString usaria UTC y correria el dia de noche). */
function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toLocaleDateString('en-CA');
}

@Component({
  selector: 'app-estadisticas',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.scss',
})
export class Estadisticas {
  private readonly api = inject(AdminEstadisticasService);

  protected readonly desde = signal(haceDias(30));
  protected readonly hasta = signal(haceDias(0));
  protected readonly estadoPantalla = signal<EstadoPantalla>('cargando');
  protected readonly resumen = signal<ResumenVentas | null>(null);
  protected readonly productos = signal<VentasProductos | null>(null);
  protected readonly clientes = signal<ClientesSegmentados | null>(null);

  protected readonly sugerencias = signal<Sugerencias | null>(null);
  protected readonly generando = signal(false);
  protected readonly errorIa = signal(false);

  /** Para dibujar las barras por dia como porcentaje del dia mas alto. */
  protected readonly maximoDia = computed(() =>
    Math.max(1, ...(this.resumen()?.ventas_por_dia ?? []).map((d) => d.total)),
  );

  constructor() {
    effect(() => {
      void this.cargar(this.desde(), this.hasta());
    });
  }

  private async cargar(desde: string, hasta: string): Promise<void> {
    this.estadoPantalla.set('cargando');
    try {
      const [resumen, productos, clientes] = await Promise.all([
        firstValueFrom(this.api.resumen(desde, hasta)),
        firstValueFrom(this.api.productos(desde, hasta)),
        firstValueFrom(this.api.clientes()),
      ]);
      this.resumen.set(resumen);
      this.productos.set(productos);
      this.clientes.set(clientes);
      this.estadoPantalla.set('ok');
    } catch {
      this.estadoPantalla.set('error');
    }
  }

  protected async generarSugerencias(): Promise<void> {
    this.generando.set(true);
    this.errorIa.set(false);
    try {
      this.sugerencias.set(await firstValueFrom(this.api.sugerencias(this.desde(), this.hasta())));
    } catch {
      this.errorIa.set(true);
    } finally {
      this.generando.set(false);
    }
  }
}
