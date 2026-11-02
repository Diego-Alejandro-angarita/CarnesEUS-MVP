import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PaginaUsuarios, UsuarioAdmin } from '../models/usuario-admin';

export const TAMANO_PAGINA_USUARIOS = 20;

/** Panel administrativo de usuarios (FR-19): listar y activar/desactivar cuentas. */
@Injectable({ providedIn: 'root' })
export class AdminUsuariosService {
  private readonly http = inject(HttpClient);

  listar(pagina: number): Observable<PaginaUsuarios> {
    const params = new HttpParams().set('page', pagina).set('page_size', TAMANO_PAGINA_USUARIOS);
    return this.http.get<PaginaUsuarios>('/api/auth/usuarios/', { params });
  }

  cambiarActivo(id: number, activo: boolean): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(`/api/auth/usuarios/${id}/`, { is_active: activo });
  }
}
