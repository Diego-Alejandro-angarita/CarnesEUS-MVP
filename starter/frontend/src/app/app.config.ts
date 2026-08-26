import {
  provideHttpClient,
  withFetch,
  withXsrfConfiguration,
} from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

// Fechas y numeros en formato colombiano en toda la aplicacion.
registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      // Angular usa por defecto la cookie XSRF-TOKEN y el header X-XSRF-TOKEN;
      // Django espera csrftoken y X-CSRFToken. Se ajusta aqui para dejar el
      // backend con su configuracion estandar.
      withXsrfConfiguration({
        cookieName: 'csrftoken',
        headerName: 'X-CSRFToken',
      }),
      // Los interceptores del equipo (manejo de errores, etc.) van aqui:
      //   withInterceptors([errorInterceptor]),
    ),
  ],
};
