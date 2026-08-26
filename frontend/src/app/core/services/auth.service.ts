import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Direccion, Usuario } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _usuario = signal<Usuario | null>(null);
  private readonly _cargado = signal(false);

  /** Usuario de la sesion actual, o null si no ha iniciado sesion. */
  readonly usuario = this._usuario.asReadonly();
  /** Falso hasta que se resuelve la primera consulta a /me. */
  readonly cargado = this._cargado.asReadonly();
  readonly estaAutenticado = computed(() => this._usuario() !== null);
  readonly esStaff = computed(() => this._usuario()?.es_staff ?? false);

  /**
   * Prepara la sesion al arrancar la aplicacion.
   *
   * Primero pide la cookie CSRF: sin ella, el primer POST (incluido el login)
   * seria rechazado por Django. Despues averigua si ya hay sesion abierta.
   */
  async inicializar(): Promise<void> {
    try {
      await firstValueFrom(this.http.get('/api/auth/csrf/'));
    } catch {
      // Si el backend no responde, la app igual debe cargar y mostrar el error
      // en su momento, no quedarse en blanco.
    }
    await this.refrescarUsuario();
    this._cargado.set(true);
  }

  async refrescarUsuario(): Promise<void> {
    try {
      const usuario = await firstValueFrom(this.http.get<Usuario>('/api/auth/me/'));
      this._usuario.set(usuario);
    } catch {
      this._usuario.set(null);
    }
  }

  async login(email: string, password: string): Promise<Usuario> {
    const usuario = await firstValueFrom(
      this.http.post<Usuario>('/api/auth/login/', { email, password }),
    );
    this._usuario.set(usuario);
    return usuario;
  }

  async registro(datos: {
    email: string;
    nombre_completo: string;
    telefono: string;
    password: string;
    password2: string;
  }): Promise<Usuario> {
    const usuario = await firstValueFrom(
      this.http.post<Usuario>('/api/auth/registro/', datos),
    );
    this._usuario.set(usuario);
    return usuario;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout/', {}));
    } finally {
      // Pase lo que pase en el servidor, aqui la sesion se da por cerrada.
      this._usuario.set(null);
    }
  }

  /** Lo usa el interceptor cuando el backend responde 401/403. */
  limpiarSesion(): void {
    this._usuario.set(null);
  }

  direcciones() {
    return this.http.get<Direccion[]>('/api/auth/direcciones/');
  }

  crearDireccion(datos: Partial<Direccion>) {
    return this.http.post<Direccion>('/api/auth/direcciones/', datos);
  }

  eliminarDireccion(id: number) {
    return this.http.delete<void>(`/api/auth/direcciones/${id}/`);
  }
}
