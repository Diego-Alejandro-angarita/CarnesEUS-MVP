export interface ItemCarrito {
  id: number;
  producto_id: number;
  nombre: string;
  slug: string;
  presentacion: string;
  foto_url: string;
  precio: number;
  cantidad: number;
  comprable: boolean;
  subtotal: number;
}

export interface Carrito {
  token: string;
  items: ItemCarrito[];
  cantidad_items: number;
  total: number;
}