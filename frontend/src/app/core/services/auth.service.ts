import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Usuario } from '../models/usuario';

export interface DatosLogin {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly usuario = signal<Usuario | null>(null);
  readonly verificando = signal(true);

  /** Consulta si ya hay una sesion activa. Se llama una vez al arrancar la app. */
  verificarSesion(): void {
    this.http.get<Usuario>('/api/auth/quien-soy/').subscribe({
      next: (usuario) => {
        this.usuario.set(usuario);
        this.verificando.set(false);
      },
      error: () => {
        this.usuario.set(null);
        this.verificando.set(false);
      },
    });
  }

  iniciarSesion(datos: DatosLogin): Observable<Usuario> {
    return this.http
      .post<Usuario>('/api/auth/login/', datos)
      .pipe(tap((usuario) => this.usuario.set(usuario)));
  }

  cerrarSesion(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout/', {})
      .pipe(tap(() => this.usuario.set(null)));
  }
}
