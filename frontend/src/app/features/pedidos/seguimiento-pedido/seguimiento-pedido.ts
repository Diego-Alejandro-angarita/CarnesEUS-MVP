import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { EtapaPedido, Pedido } from '../../../core/models/pedido';

export const ETIQUETAS_ETAPA: Record<EtapaPedido, string> = {
  recibido: 'Recibido',
  en_preparacion: 'En preparacion',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Que significa cada etapa para quien espera el pedido. */
export const AYUDA_ETAPA: Record<EtapaPedido, string> = {
  recibido: 'Recibimos el pedido y pronto empezamos a alistarlo.',
  en_preparacion: 'Estamos cortando y empacando los productos.',
  en_camino: 'El pedido salio y va camino a la direccion de entrega.',
  entregado: 'El pedido ya fue entregado.',
  cancelado: 'El pedido se cancelo y no se va a entregar.',
};

const FLUJO: EtapaPedido[] = ['recibido', 'en_preparacion', 'en_camino', 'entregado'];

type EstadoPaso = 'hecho' | 'actual' | 'pendiente';

interface Paso {
  etapa: EtapaPedido;
  estado: EstadoPaso;
  fecha: string | null;
}

/**
 * Linea de tiempo del pedido (FR-12): las etapas que ya paso con su fecha, la
 * actual resaltada y las que faltan. Un pedido cancelado no muestra lo que ya
 * no va a pasar.
 */
@Component({
  selector: 'app-seguimiento-pedido',
  imports: [DatePipe],
  templateUrl: './seguimiento-pedido.html',
  styleUrl: './seguimiento-pedido.scss',
})
export class SeguimientoPedido {
  readonly pedido = input.required<Pick<Pedido, 'etapa' | 'seguimiento'>>();

  protected readonly etiquetas = ETIQUETAS_ETAPA;
  protected readonly ayuda = AYUDA_ETAPA;

  protected readonly pasos = computed<Paso[]>(() => {
    const { etapa, seguimiento } = this.pedido();
    const fechas = new Map(seguimiento.map((paso) => [paso.etapa, paso.fecha]));

    const etapas = etapa === 'cancelado' ? seguimiento.map((paso) => paso.etapa) : FLUJO;
    const actual = etapas.indexOf(etapa);

    return etapas.map((nombre, indice) => ({
      etapa: nombre,
      estado: indice < actual ? 'hecho' : indice === actual ? 'actual' : 'pendiente',
      fecha: fechas.get(nombre) ?? null,
    }));
  });
}
