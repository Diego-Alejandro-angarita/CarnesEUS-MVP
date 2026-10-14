export type MetodoPago = 'transferencia' | 'contraentrega_qr' | 'contraentrega_datafono';
export type EstadoPedido = 'por_confirmar' | 'por_cobrar' | 'pagado';
/** En que va el pedido (FR-12), aparte de como va el pago (`EstadoPedido`). */
export type EtapaPedido = 'recibido' | 'en_preparacion' | 'en_camino' | 'entregado' | 'cancelado';

/** Una etapa por la que ya paso el pedido y cuando. */
export interface PasoSeguimiento {
  etapa: EtapaPedido;
  etapa_nombre: string;
  fecha: string;
}

/** Lo que se envia a POST /api/pedidos/. */
export interface NuevoPedido {
  metodo_pago: MetodoPago;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  municipio: string;
  barrio: string;
  notas: string;
  acepta_comunicaciones: boolean;
}

export interface ItemPedido {
  producto_id: number;
  producto_slug: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Pago {
  metodo: MetodoPago;
  metodo_nombre: string;
  estado: 'pendiente' | 'aprobado';
  monto: number;
  referencia: string;
}

/** Datos de la cuenta a la que se paga cuando el metodo es transferencia. */
export interface DatosTransferencia {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
}

export interface Pedido {
  id: number;
  estado: EstadoPedido;
  etapa: EtapaPedido;
  etapa_nombre: string;
  /** A que etapas puede pasar desde la actual; las reglas las pone el backend. */
  etapas_siguientes: EtapaPedido[];
  seguimiento: PasoSeguimiento[];
  total: number;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  municipio: string;
  barrio: string;
  notas: string;
  items: ItemPedido[];
  pago: Pago;
  instrucciones_pago: DatosTransferencia | null;
  creado_en: string;
}

/** Una fila del listado de pedidos del panel administrativo (FR-19). */
export interface PedidoLista {
  id: number;
  nombre: string;
  municipio: string;
  barrio: string;
  estado: EstadoPedido;
  etapa: EtapaPedido;
  total: number;
  metodo_pago: string;
  creado_en: string;
}

export interface PaginaPedidos {
  count: number;
  next: string | null;
  previous: string | null;
  results: PedidoLista[];
}
/** Una fila de "Mis pedidos" (FR-12). */
export interface PedidoCliente {
  id: number;
  creado_en: string;
  total: number;
  etapa: EtapaPedido;
  etapa_nombre: string;
  metodo_pago: string;
}

export interface PaginaPedidosCliente {
  count: number;
  next: string | null;
  previous: string | null;
  results: PedidoCliente[];
}
