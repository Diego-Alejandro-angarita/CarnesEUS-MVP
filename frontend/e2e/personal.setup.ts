import { execSync } from 'node:child_process';

import { expect, test as setup } from '@playwright/test';

/**
 * Inicia sesion como personal (FR-19) una sola vez y guarda la sesion para el
 * resto de las pruebas: las pantallas /admin/* y la API de productos la piden.
 */

// Tiene que coincidir con el storageState de playwright.config.ts.
const SESION_PERSONAL = 'e2e/.auth/personal.json';

const EMAIL = 'e2e-personal@carneseus.test';
const CLAVE = 'UnaClaveSegura123';

/**
 * Crea el usuario con createsuperuser. Si ya existe el comando falla, y no
 * importa: el login de abajo dice si de verdad se puede entrar.
 *
 * En CI Django corre en la maquina; en local, dentro de docker compose.
 */
function crearPersonal() {
  const comando = process.env['CI']
    ? `python manage.py createsuperuser --noinput --email ${EMAIL}`
    : `docker compose exec -T -e DJANGO_SUPERUSER_PASSWORD=${CLAVE} backend ` +
      `python manage.py createsuperuser --noinput --email ${EMAIL}`;
  try {
    execSync(comando, {
      cwd: process.env['CI'] ? '../backend' : '..',
      env: { ...process.env, DJANGO_SUPERUSER_PASSWORD: CLAVE },
      stdio: 'pipe',
    });
  } catch {
    // Ya existia.
  }
}

setup('sesion de personal', async ({ page }) => {
  crearPersonal();

  // Por el proxy de Angular, para que la cookie quede en el mismo origen que
  // usa la pagina.
  const respuesta = await page.request.post('/api/auth/login/', {
    data: { email: EMAIL, password: CLAVE },
  });
  expect(respuesta.status(), `No se pudo iniciar sesion como ${EMAIL}`).toBe(200);

  await page.context().storageState({ path: SESION_PERSONAL });
});
