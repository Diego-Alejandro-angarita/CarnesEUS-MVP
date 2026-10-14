export interface VentaDia { dia: string; total: number; pedidos: number; }

export interface ResumenVentas {
  desde: string;
  hasta: string;
  total_vendido: number;
  numero_pedidos: number;
  ticket_promedio: number;
  clientes_unicos: number;
  ventas_por_dia: VentaDia[];
}

export interface FilaVenta {
  nombre?: string;
  categoria?: string;
  municipio?: string;
  barrio?: string;
  metodo?: string;
  unidades?: number;
  ingresos?: number;
  pedidos?: number;
  total?: number;
}

export interface VentasProductos {
  mas_vendidos: FilaVenta[];
  por_categoria: FilaVenta[];
  por_barrio: FilaVenta[];
  por_metodo_pago: FilaVenta[];
}

export type Segmento = 'nuevo' | 'recurrente' | 'inactivo';

export interface ClientesSegmentados {
  segmentos: Record<Segmento, number>;
}

export interface Campana { segmento: Segmento; destinatarios: number; mensaje: string; }

export interface Sugerencias {
  origen: 'ia' | 'reglas';
  sugerencias: string[];
  campanas: Campana[];
}
