import { Component } from '@angular/core';

import { IndicadorCobertura } from './indicador-cobertura';

/** Pagina /cobertura: el indicador de FR-15 solo, sin otro formulario alrededor. */
@Component({
  selector: 'app-cobertura',
  imports: [IndicadorCobertura],
  template: '<app-indicador-cobertura />',
})
export class Cobertura {}