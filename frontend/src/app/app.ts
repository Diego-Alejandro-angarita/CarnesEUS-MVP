import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/** Respuesta de /api/salud/, el endpoint de comprobacion del backend. */
interface Salud {
  estado: string;
  base_de_datos: boolean;
}

type EstadoConexion = 'comprobando' | 'ok' | 'error';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);

  /**
   * Estado de la conexion con el backend.
   *
   * Es solo una comprobacion de instalacion: confirma que Angular, el proxy,
   * Django y Postgres estan conectados. Se puede borrar junto con la pantalla
   * de bienvenida cuando empiecen las historias de usuario.
   */
  protected readonly conexion = signal<EstadoConexion>('comprobando');

  constructor() {
    void this.comprobarBackend();
  }

  private async comprobarBackend(): Promise<void> {
    try {
      const salud = await firstValueFrom(this.http.get<Salud>('/api/salud/'));
      this.conexion.set(salud.base_de_datos ? 'ok' : 'error');
    } catch {
      this.conexion.set('error');
    }
  }
}
