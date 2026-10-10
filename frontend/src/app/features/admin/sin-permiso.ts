import { HttpErrorResponse } from '@angular/common/http';

/**
 * Las promociones son solo para el personal: el backend responde 403 a quien
 * no tiene sesion de staff. Las pantallas lo usan para mostrar el aviso en vez
 * de un error generico.
 */
export function esSinPermiso(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 401);
}
