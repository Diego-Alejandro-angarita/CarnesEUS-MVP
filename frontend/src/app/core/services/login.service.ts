import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Usuario } from '../models/usuario';

export interface DatosLogin {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly http = inject(HttpClient);

  iniciarSesion(datos: DatosLogin): Observable<Usuario> {
    return this.http.post<Usuario>('/api/auth/login/', datos);
  }
}
