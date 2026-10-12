import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RespuestaCobertura, ZonaCobertura } from '../models/cobertura';

@Injectable({ providedIn: 'root' })
export class CoberturaService {
  private readonly http = inject(HttpClient);

  /** Pregunta al backend si hay domicilios al barrio indicado (FR-15). */
  verificar(municipio: string, barrio: string): Observable<RespuestaCobertura> {
    const params = new HttpParams().set('municipio', municipio.trim()).set('barrio', barrio.trim());
    return this.http.get<RespuestaCobertura>('/api/cobertura/', { params });
  }

  /** Barrios con cobertura, para sugerirlos mientras el cliente escribe. */
  zonas(): Observable<ZonaCobertura[]> {
    return this.http.get<ZonaCobertura[]>('/api/cobertura/zonas/');
  }
}