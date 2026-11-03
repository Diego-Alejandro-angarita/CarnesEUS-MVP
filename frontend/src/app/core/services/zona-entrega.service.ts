import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MUNICIPIO_COBERTURA } from '../data/comunas-medellin';
import { CoberturaService } from './cobertura.service';

const CLAVE_ZONA = 'carneseus.zona-entrega';

interface ZonaGuardada {
  comuna: string;
  cubierta: boolean;
}

/** Comuna de entrega que el cliente eligio, compartida por toda la aplicacion. */
@Injectable({ providedIn: 'root' })
export class ZonaEntregaService {
  private readonly cobertura = inject(CoberturaService);
  private readonly estado = signal<ZonaGuardada | null>(this.leer());

  readonly comuna = computed(() => this.estado()?.comuna ?? null);
  /** true/false segun la consulta; null si todavia no eligio comuna. */
  readonly cubierta = computed(() => this.estado()?.cubierta ?? null);

  /** Consulta la cobertura de la comuna, la recuerda y devuelve si hay cobertura. */
  async elegir(comuna: string): Promise<boolean> {
    const respuesta = await firstValueFrom(this.cobertura.verificar(MUNICIPIO_COBERTURA, comuna));
    this.guardar({ comuna, cubierta: respuesta.cubierta });
    return respuesta.cubierta;
  }

  /** Olvida la comuna: la proxima vez que agregue al carrito se la volvemos a pedir. */
  limpiar(): void {

    this.guardar(null);
  }
  /** Guarda un resultado que ya se consulto en otra parte (por ejemplo la pagina /cobertura). */
  recordar(comuna: string, cubierta: boolean): void {
    this.guardar({ comuna, cubierta });
  }
  
  private guardar(zona: ZonaGuardada | null): void {
    this.estado.set(zona);
    try {
      if (zona) {
        localStorage.setItem(CLAVE_ZONA, JSON.stringify(zona));
      } else {
        localStorage.removeItem(CLAVE_ZONA);
      }
    } catch {
      /* sin almacenamiento, la comuna dura lo que dure la pestana */
    }
  }

  private leer(): ZonaGuardada | null {
    try {
      const crudo = localStorage.getItem(CLAVE_ZONA);
      if (!crudo) {
        return null;
      }
      const dato = JSON.parse(crudo);
      return typeof dato?.comuna === 'string' && typeof dato?.cubierta === 'boolean' ? dato : null;
    } catch {
      return null;
    }
  }
}