import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { ClaveTutorial, PasoTutorial, TUTORIALES } from './tutoriales';

/** Claves de tutorial del panel; se marcan todas con "No mostrar mas". */
const CLAVES_ADMIN = (Object.keys(TUTORIALES) as ClaveTutorial[]).filter((c) =>
  c.startsWith('admin.'),
);

/**
 * Coordina los tutoriales de primer acceso (FR-20): decide cuales estan
 * pendientes para la cuenta actual, los abre y guarda cuales ya se vieron.
 */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly activo = signal<ClaveTutorial | null>(null);
  readonly pasos = signal<PasoTutorial[]>([]);
  readonly indice = signal(0);

  /** El tutorial abierto se mostro con ver(): al cerrarlo no se guarda nada. */
  private soloVer = false;

  /** Paso que se muestra ahora, o null si no hay tutorial abierto. */
  readonly pasoActual = computed<PasoTutorial | null>(() => {
    const pasos = this.pasos();
    return pasos[this.indice()] ?? null;
  });

  /**
   * `true` si la clave todavia no la vio la cuenta actual y corresponde a su
   * rol (`cliente` solo para no staff; `admin.*` solo para staff).
   */
  pendiente(clave: ClaveTutorial): boolean {
    const usuario = this.auth.usuario();
    if (!usuario) {
      return false;
    }
    if (usuario.tutoriales_vistos.includes(clave)) {
      return false;
    }
    const esAdmin = clave.startsWith('admin.');
    return esAdmin ? usuario.is_staff : !usuario.is_staff;
  }

  /**
   * Abre el tutorial si esta pendiente y no hay otro abierto. Omite los pasos
   * cuyo ancla no esta en el DOM; si no queda ninguno, no abre nada ni marca
   * la clave.
   */
  iniciarSiPendiente(clave: ClaveTutorial): void {
    if (this.activo() !== null || !this.pendiente(clave)) {
      return;
    }
    const pasos = this.pasosVisibles(clave);
    if (pasos.length === 0) {
      return;
    }
    this.abrir(clave, pasos, false);
  }

  /** Reabre un tutorial aunque ya se haya visto (CA-7). No guarda nada al cerrar. */
  ver(clave: ClaveTutorial): void {
    const pasos = this.pasosVisibles(clave);
    if (pasos.length === 0) {
      return;
    }
    this.abrir(clave, pasos, true);
  }

  siguiente(): void {
    const siguiente = this.indice() + 1;
    if (siguiente >= this.pasos().length) {
      this.terminar();
      return;
    }
    this.indice.set(siguiente);
  }

  anterior(): void {
    this.indice.set(Math.max(0, this.indice() - 1));
  }

  /** Cierra el tutorial marcando su clave como vista. */
  saltar(): void {
    this.terminar();
  }

  /** Cierra el tutorial actual y marca como vistas todas las claves del panel. */
  noMostrarMas(): void {
    this.cerrar();
    this.marcar(CLAVES_ADMIN);
  }

  private terminar(): void {
    const clave = this.activo();
    const soloVer = this.soloVer;
    this.cerrar();
    if (clave && !soloVer) {
      this.marcar([clave]);
    }
  }

  private abrir(clave: ClaveTutorial, pasos: PasoTutorial[], soloVer: boolean): void {
    this.pasos.set(pasos);
    this.indice.set(0);
    this.soloVer = soloVer;
    this.activo.set(clave);
  }

  private cerrar(): void {
    this.activo.set(null);
    this.pasos.set([]);
    this.indice.set(0);
    this.soloVer = false;
  }

  /** Pasos de una clave cuyo ancla (si lo tienen) existe en el DOM. */
  private pasosVisibles(clave: ClaveTutorial): PasoTutorial[] {
    return TUTORIALES[clave].filter(
      (paso) => !paso.ancla || document.querySelector(`[data-tutorial="${paso.ancla}"]`) !== null,
    );
  }

  /**
   * Marca claves como vistas: primero actualiza el usuario en memoria (para que
   * navegar no reabra el tutorial) y luego lo persiste. Ignora errores del POST.
   */
  private marcar(claves: ClaveTutorial[]): void {
    const usuario = this.auth.usuario();
    if (!usuario) {
      return;
    }
    const vistos = new Set(usuario.tutoriales_vistos);
    for (const clave of claves) {
      vistos.add(clave);
    }
    this.auth.usuario.update((actual) =>
      actual ? { ...actual, tutoriales_vistos: [...vistos] } : actual,
    );
    this.http.post('/api/auth/tutoriales/vistos/', { claves }).subscribe({
      error: () => undefined,
    });
  }
}
