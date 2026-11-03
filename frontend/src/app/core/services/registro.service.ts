import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Usuario } from '../models/usuario';

export interface DatosRegistro {
  first_name: string;
  last_name: string;
  email: string;
  telefono: string;
  password: string;
  password_confirmacion: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroService {
  private readonly http = inject(HttpClient);

  registrar(datos: DatosRegistro): Observable<Usuario> {
    return this.http.post<Usuario>('/api/auth/registro/', datos);
  }
}
