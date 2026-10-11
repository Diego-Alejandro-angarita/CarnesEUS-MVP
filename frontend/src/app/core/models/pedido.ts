export type MetodoPago = 'transferencia' | 'contraentrega_qr' | 'contraentrega_datafono';

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
  estado: 'por_confirmar' | 'por_cobrar' | 'pagado';
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