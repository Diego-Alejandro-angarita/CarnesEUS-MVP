import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Espera a que la sesion este resuelta.
 *
 * Al recargar la pagina directamente sobre una ruta protegida, el guard corre
 * antes de que se sepa si hay sesion; sin esto, siempre rebotaria a login.
 */
async function sesionResuelta(auth: AuthService): Promise<void> {
  if (!auth.cargado()) {
    await auth.inicializar();
  }
}

/** Exige sesion abierta; si no la hay, manda a login y recuerda a donde iba. */
export const authGuard: CanActivateFn = async (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await sesionResuelta(auth);

  if (auth.estaAutenticado()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { redirigir: estado.url },
  });
};

/** Protege el panel de la carniceria (FR-19). */
export const staffGuard: CanActivateFn = async (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await sesionResuelta(auth);

  if (!auth.estaAutenticado()) {
    return router.createUrlTree(['/login'], {
      queryParams: { redirigir: estado.url },
    });
  }
  // Quien tiene sesion pero no es del personal se devuelve a la tienda.
  return auth.esStaff() ? true : router.createUrlTree(['/']);
};

/** Para login y registro: quien ya inicio sesion no deberia verlas. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await sesionResuelta(auth);
  return auth.estaAutenticado() ? router.createUrlTree(['/']) : true;
};
