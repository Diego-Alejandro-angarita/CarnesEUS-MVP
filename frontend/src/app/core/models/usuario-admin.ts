/** Un cliente visto desde el panel administrativo (FR-19). */
export interface UsuarioAdmin {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  telefono: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
}

export interface PaginaUsuarios {
  count: number;
  next: string | null;
  previous: string | null;
  results: UsuarioAdmin[];
}
