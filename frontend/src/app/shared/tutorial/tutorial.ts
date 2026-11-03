import {
  AfterViewChecked,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { TutorialService } from '../../core/tutorial/tutorial.service';

/** Rectangulo del elemento resaltado, en coordenadas del viewport. */
interface Recuadro {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Capa y tarjeta del tutorial de primer acceso (FR-20). Un unico
 * `<app-tutorial />` montado en `app.html` reacciona al `TutorialService`.
 */
@Component({
  selector: 'app-tutorial',
  imports: [],
  templateUrl: './tutorial.html',
  styleUrl: './tutorial.scss',
})
export class Tutorial implements AfterViewChecked {
  private readonly tutorial = inject(TutorialService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tarjeta = viewChild<ElementRef<HTMLElement>>('tarjeta');

  protected readonly activo = this.tutorial.activo;
  protected readonly indice = this.tutorial.indice;
  protected readonly paso = this.tutorial.pasoActual;
  protected readonly total = computed(() => this.tutorial.pasos().length);
  protected readonly esUltimo = computed(() => this.indice() === this.total() - 1);
  protected readonly esPrimero = computed(() => this.indice() === 0);
  protected readonly esPanel = computed(() => this.activo() === 'admin.panel');

  /** Recuadro del elemento resaltado, o null si el paso no tiene ancla. */
  protected readonly recuadro = signal<Recuadro | null>(null);

  /** Elemento que tenia el foco antes de abrir, para devolverlo al cerrar. */
  private focoPrevio: HTMLElement | null = null;
  /** Para enfocar la tarjeta una sola vez tras abrir cada paso. */
  private debeEnfocar = false;

  private readonly recolocar = () => this.medir();

  constructor() {
    effect(() => {
      const paso = this.paso();
      if (paso) {
        this.focoPrevio ??= (document.activeElement as HTMLElement | null) ?? null;
        this.debeEnfocar = true;
        queueMicrotask(() => this.medir());
      } else {
        this.devolverFoco();
      }
    });

    window.addEventListener('resize', this.recolocar);
    window.addEventListener('scroll', this.recolocar, true);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', this.recolocar);
      window.removeEventListener('scroll', this.recolocar, true);
    });
  }

  ngAfterViewChecked(): void {
    if (this.debeEnfocar && this.tarjeta()) {
      this.debeEnfocar = false;
      this.tarjeta()!.nativeElement.focus();
    }
  }

  protected siguiente(): void {
    this.tutorial.siguiente();
  }

  protected anterior(): void {
    this.tutorial.anterior();
  }

  protected saltar(): void {
    this.tutorial.saltar();
  }

  protected noMostrarMas(): void {
    this.tutorial.noMostrarMas();
  }

  protected alTeclado(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.saltar();
      return;
    }
    if (evento.key === 'Tab') {
      this.atraparFoco(evento);
    }
  }

  /** Mide el elemento del paso actual y actualiza el recuadro resaltado. */
  private medir(): void {
    const paso = this.paso();
    if (!paso?.ancla) {
      this.recuadro.set(null);
      return;
    }
    const elemento = document.querySelector<HTMLElement>(`[data-tutorial="${paso.ancla}"]`);
    if (!elemento) {
      this.recuadro.set(null);
      return;
    }
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    elemento.scrollIntoView({ block: 'center', behavior: reducir ? 'auto' : 'smooth' });
    const r = elemento.getBoundingClientRect();
    this.recuadro.set({ top: r.top, left: r.left, width: r.width, height: r.height });
  }

  private devolverFoco(): void {
    if (this.focoPrevio) {
      this.focoPrevio.focus();
      this.focoPrevio = null;
    }
  }

  /** Mantiene el foco dentro de la tarjeta mientras el tutorial esta abierto. */
  private atraparFoco(evento: KeyboardEvent): void {
    const tarjeta = this.tarjeta()?.nativeElement;
    if (!tarjeta) {
      return;
    }
    const focos = tarjeta.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focos.length === 0) {
      return;
    }
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
