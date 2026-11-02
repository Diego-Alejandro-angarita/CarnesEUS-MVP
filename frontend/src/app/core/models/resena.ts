export interface Resena {
  id: number;
  usuario_nombre: string;
  calificacion: number;
  comentario: string;
  es_propia: boolean;
  creado_en: string;
}

export interface PaginaResenas {
  count: number;
  next: string | null;
  previous: string | null;
  results: Resena[];
}

export interface PuedeResenar {
  ha_comprado: boolean;
  ya_reseno: boolean;
  puede_resenar: boolean;
}

export interface DatosResena {
  calificacion: number;
  comentario: string;
}
