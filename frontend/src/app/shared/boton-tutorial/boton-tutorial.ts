import { Component, inject, input } from '@angular/core';

import { TutorialService } from '../../core/tutorial/tutorial.service';
import { ClaveTutorial } from '../../core/tutorial/tutoriales';

/** Enlace discreto que vuelve a abrir el tutorial de una pantalla (FR-20, CA-7). */
@Component({
  selector: 'app-boton-tutorial',
  template: `
    <button type="button" class="boton-tutorial" (click)="abrir()">Ver tutorial</button>
  `,
  styles: `
    .boton-tutorial {
      padding: 0;
      border: none;
      background: none;
      color: var(--color-texto-suave, #a89e8d);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class BotonTutorial {
  private readonly tutorial = inject(TutorialService);

  readonly clave = input.required<ClaveTutorial>();

  protected abrir(): void {
    this.tutorial.ver(this.clave());
  }
}
