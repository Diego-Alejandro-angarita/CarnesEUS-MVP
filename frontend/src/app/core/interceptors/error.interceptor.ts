import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/** Rutas donde un 403 es una respuesta normal y no significa sesion vencida. */
const RUTAS_DE_SESION = ['/api/auth/me/', '/api/auth/login/', '/api/auth/registro/'];

export const errorInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return siguiente(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      const esRutaDeSesion = RUTAS_DE_SESION.some((r) => peticion.url.startsWith(r));

      // DRF responde 403 (no 401) cuando la sesion por cookie expira.
      if ((error.status === 401 || error.status === 403) && !esRutaDeSesion) {
        auth.limpiarSesion();
        router.navigate(['/login'], {
          queryParams: { redirigir: router.url, expirada: '1' },
        });
      }
      return throwError(() => error);
    }),
  );
};
