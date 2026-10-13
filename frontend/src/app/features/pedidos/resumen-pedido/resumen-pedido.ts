import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { Pedido } from '../../../core/models/pedido';
import { SeguimientoPedido } from '../seguimiento-pedido/seguimiento-pedido';

/**
 * Lo que el cliente ve de un pedido (FR-12): en que va, a donde llega, como
 * paga y que compro. Lo comparten "Mis pedidos" y la consulta sin cuenta.
 */
@Component({
  selector: 'app-resumen-pedido',
  imports: [CurrencyPipe, SeguimientoPedido],
  templateUrl: './resumen-pedido.html',
  styleUrl: './resumen-pedido.scss',
})
export class ResumenPedido {
  readonly pedido = input.required<Pedido>();
}
