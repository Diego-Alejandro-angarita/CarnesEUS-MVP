// Tipos que reflejan lo que devuelve la API.
// El contrato completo esta en http://localhost:8001/api/docs/ (OpenAPI).

export type Rol = 'CLIENTE' | 'STAFF';

export interface Usuario {
  id: number;
  email: string;
  nombre_completo: string;
  telefono: string;
  rol: Rol;
  es_staff: boolean;
}

export interface Direccion {
  id: number;
  etiqueta: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  notas: string;
  es_principal: boolean;
  /** Lo calcula el backend a partir de la ciudad (FR-15). */
  en_zona_cobertura: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  orden: number;
}

export type UnidadMedida = 'KG' | 'UNIDAD';

export interface Producto {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  categoria: number;
  categoria_nombre: string;
  categoria_slug: string;
  precio: string;
  unidad_medida: UnidadMedida;
  unidad_medida_display: string;
  stock: string;
  disponible: boolean;
  hay_existencias: boolean;
  imagen: string | null;
}

export interface ItemCarrito {
  id: number;
  producto: number;
  producto_detalle: Producto;
  cantidad: string;
  subtotal: string;
}

export interface Carrito {
  id: number;
  items: ItemCarrito[];
  subtotal: string;
}

export type EstadoPedido =
  | 'PENDIENTE_PAGO'
  | 'PAGADO'
  | 'EN_PREPARACION'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO';

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO' | 'ERROR';

export interface ItemPedido {
  id: number;
  producto: number | null;
  nombre_producto: string;
  precio_unitario: string;
  unidad_medida: string;
  cantidad: string;
  subtotal: string;
}

export interface Pedido {
  id: number;
  numero: string;
  estado: EstadoPedido;
  estado_display: string;
  estado_pago: EstadoPago | null;
  direccion_texto: string;
  subtotal: string;
  descuento: string;
  costo_domicilio: string;
  total: string;
  notas: string;
  items: ItemPedido[];
  cliente_email: string;
  cliente_nombre: string;
  creado_en: string;
}

/** Lo que el backend entrega para abrir el Widget de Wompi. */
export interface DatosWidget {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
  customerData: {
    email: string;
    fullName: string;
    phoneNumber: string;
    phoneNumberPrefix: string;
  };
  shippingAddress: Record<string, string>;
}

export interface ResultadoVerificacion {
  pedido: Pedido;
  estado_pago: EstadoPago | null;
}

export interface Pagina<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FiltrosCatalogo {
  search?: string;
  categoria?: string;
  precio_min?: string;
  precio_max?: string;
  ordering?: string;
  page?: number;
}
