import { HttpErrorResponse } from '@angular/common/http';

import { ErroresPorCampo } from './admin-productos.service';

/** Normaliza el cuerpo de un 400 de DRF a mensajes por campo. */
export function erroresDelBackend(respuesta: HttpErrorResponse): ErroresPorCampo {
  const cuerpo: unknown = respuesta.error;
  if (!cuerpo || typeof cuerpo !== 'object') {
    return {};
  }

  const salida: ErroresPorCampo = {};
  for (const [campo, valor] of Object.entries(cuerpo as Record<string, unknown>)) {
    salida[campo] = Array.isArray(valor) ? valor.map(String) : [String(valor)];
  }
  return salida;
}
