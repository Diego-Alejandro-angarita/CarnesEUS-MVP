import { HttpErrorResponse } from '@angular/common/http';

/**
 * Convierte un error de DRF en algo que se le pueda mostrar a una persona.
 *
 * DRF devuelve varias formas segun el caso: {"detail": "..."},
 * {"campo": ["..."]} o una lista suelta. Sin esto, cada pantalla terminaria
 * inventando su propia manera de leerlas.
 */
export function mensajeDeError(error: unknown, porDefecto = 'Ocurrio un error inesperado.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return porDefecto;
  }

  if (error.status === 0) {
    return 'No se pudo conectar con el servidor. Verifica que el backend este corriendo.';
  }

  const cuerpo = error.error;
  if (typeof cuerpo === 'string' && cuerpo.trim()) {
    return cuerpo;
  }
  if (cuerpo?.detail) {
    return String(cuerpo.detail);
  }

  if (cuerpo && typeof cuerpo === 'object') {
    const mensajes = Object.values(cuerpo)
      .flat()
      .map((m) => String(m))
      .filter(Boolean);
    if (mensajes.length) {
      return mensajes.join(' ');
    }
  }

  return porDefecto;
}
