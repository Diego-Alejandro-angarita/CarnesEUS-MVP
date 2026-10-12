import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Deja pasar solo a personal (is_staff) a las pantallas de administracion
 * (FR-19). Espera a que termine la verificacion de sesion antes de decidir:
 * si no, un recargado directo a /admin/productos expulsaria a un
 * administrador mientras la sesion todavia se esta confirmando.
 */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.verificando).pipe(
    filter((verificando) => !verificando),
    take(1),
    map(() => auth.usuario()?.is_staff === true || router.createUrlTree(['/login'])),
  );
};
