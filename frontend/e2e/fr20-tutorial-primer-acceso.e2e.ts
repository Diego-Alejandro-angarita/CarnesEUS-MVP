import { execSync } from 'node:child_process';

import { Browser, Page, expect, test } from '@playwright/test';

/**
 * FR-20 Tutorial de primer acceso: pruebas E2E (doc seccion 6).
 *
 * Cada pantalla del panel ensena su recorrido la primera vez que la cuenta la
 * abre; se puede saltar, o apagarlos todos con "No mostrar mas tutoriales", y
 * lo visto no reaparece ni al recargar ni al volver a iniciar sesion.
 *
 * El personal se crea con empty tutoriales_vistos recien, porque no hay
 * endpoint para reiniciarlos: cada caso usa una cuenta de personal nueva (como
 * fr19 registra clientes nuevos), igual que personal.setup.ts crea su
 * superusuario. Boton de login 'Entrar'; banner de error '.mensaje--error'.
 */

const CLAVE = 'UnaClaveSegura123';

/**
 * Crea (o reinicia, si ya existiera) una cuenta de personal con la lista de
 * tutoriales vacia, mediante manage.py shell. Misma orquestacion que
 * personal.setup.ts: en CI Django corre en la maquina; en local en docker.
 *
 * El guion se pasa por stdin (no por `-c '...'`) para no depender del
 * entrecomillado del shell, que difiere entre cmd.exe y las shells POSIX.
 */
function crearPersonalNuevo(email: string): void {
  const guion =
    'from apps.accounts.models import Usuario\n' +
    `u, _ = Usuario.objects.update_or_create(email=${JSON.stringify(email)}, ` +
    'defaults={"is_staff": True, "is_superuser": True, "tutoriales_vistos": []})\n' +
    `u.set_password(${JSON.stringify(CLAVE)})\n` +
    'u.tutoriales_vistos = []\n' +
    'u.save()\n';
  const comando = process.env['CI']
    ? 'python manage.py shell'
    : 'docker compose exec -T backend python manage.py shell';
  execSync(comando, {
    cwd: process.env['CI'] ? '../backend' : '..',
    env: { ...process.env },
    input: guion,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** Correo unico por caso, para no arrastrar tutoriales de pruebas anteriores. */
function emailNuevo(sufijo: string): string {
  return `e2e-fr20-${sufijo}-${Date.now()}@carneseus.test`;
}

/** Navegador aparte, sin la sesion de personal del storageState. */
async function navegadorLimpio(browser: Browser) {
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return { contexto, pagina: await contexto.newPage() };
}

async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electronico').fill(email);
  await page.getByLabel('Contrasena', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** La tarjeta del tutorial, identificada por su rol de dialogo. */
function tarjeta(page: Page) {
  return page.getByRole('dialog');
}

/** Recorre un tutorial abierto pulsando Siguiente hasta Terminar. */
async function recorrerHastaTerminar(page: Page) {
  const siguiente = tarjeta(page).getByRole('button', { name: 'Siguiente' });
  while (await siguiente.isVisible().catch(() => false)) {
    await siguiente.click();
  }
  await tarjeta(page).getByRole('button', { name: 'Terminar' }).click();
  await expect(tarjeta(page)).toBeHidden();
}

test('personal nuevo: bienvenida resaltada, va al panel y recorre admin.panel', async ({
  browser,
}) => {
  const email = emailNuevo('bienvenida');
  crearPersonalNuevo(email);
  const { contexto, pagina } = await navegadorLimpio(browser);

  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);

  // admin.bienvenida: un solo paso que resalta el enlace Administrar.
  await expect(tarjeta(pagina)).toBeVisible();
  await expect(tarjeta(pagina)).toContainText('Tu cuenta es de personal');
  await expect(pagina.locator('[data-tutorial="cabecera-administrar"]')).toBeVisible();

  // El boton final dice "Ir al panel": marca la clave y navega a /admin, donde
  // arranca admin.panel (doc seccion 5).
  await tarjeta(pagina).getByRole('button', { name: 'Ir al panel' }).click();
  await expect(pagina).toHaveURL(/\/admin$/);
  await expect(tarjeta(pagina)).toBeVisible();
  await expect(tarjeta(pagina)).toContainText('Bienvenido al panel');

  await recorrerHastaTerminar(pagina);

  await contexto.close();
});

test('saltar admin.productos no lo hace reaparecer al recargar', async ({ browser }) => {
  const email = emailNuevo('productos');
  crearPersonalNuevo(email);
  const { contexto, pagina } = await navegadorLimpio(browser);

  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);
  // Cerrar la bienvenida del catalogo para dejar la pantalla libre.
  await tarjeta(pagina).getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  await pagina.goto('/admin/productos');
  await expect(tarjeta(pagina)).toBeVisible();
  await tarjeta(pagina).getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  await pagina.reload();
  // Tras recargar, el tutorial ya visto no vuelve.
  await expect(tarjeta(pagina)).toBeHidden();

  await contexto.close();
});

test('al volver a iniciar sesion no reaparece ningun tutorial ya visto', async ({ browser }) => {
  const email = emailNuevo('reingreso');
  crearPersonalNuevo(email);
  const { contexto, pagina } = await navegadorLimpio(browser);

  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);
  // Ver y cerrar la bienvenida; eso la marca como vista en la cuenta.
  await expect(tarjeta(pagina)).toBeVisible();
  await tarjeta(pagina).getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  await pagina.goto('/admin');
  await expect(tarjeta(pagina)).toBeVisible();
  await tarjeta(pagina).getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  // Cerrar sesion y volver a entrar: nada ya visto reaparece.
  await pagina.getByRole('button', { name: 'Salir' }).click();
  await expect(pagina).toHaveURL(/\/productos/);
  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);
  await expect(tarjeta(pagina)).toBeHidden();

  await pagina.goto('/admin');
  await expect(tarjeta(pagina)).toBeHidden();

  await contexto.close();
});

test('No mostrar mas tutoriales en admin.panel apaga el resto del panel', async ({ browser }) => {
  const email = emailNuevo('nomostrar');
  crearPersonalNuevo(email);
  const { contexto, pagina } = await navegadorLimpio(browser);

  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);
  await tarjeta(pagina).getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  await pagina.goto('/admin');
  await expect(tarjeta(pagina)).toBeVisible();
  await tarjeta(pagina).getByRole('button', { name: 'No mostrar mas tutoriales' }).click();
  await expect(tarjeta(pagina)).toBeHidden();

  // Ninguna otra pantalla del panel muestra ya su tutorial.
  await pagina.goto('/admin/pedidos');
  await expect(tarjeta(pagina)).toBeHidden();

  await contexto.close();
});

test('en un celular (375px) la tarjeta queda dentro de la pantalla', async ({ browser }) => {
  const email = emailNuevo('movil');
  crearPersonalNuevo(email);
  const { contexto, pagina } = await navegadorLimpio(browser);
  await pagina.setViewportSize({ width: 375, height: 667 });

  await iniciarSesion(pagina, email);
  await expect(pagina).toHaveURL(/\/productos/);
  await expect(tarjeta(pagina)).toBeVisible();

  // La tarjeta queda entera dentro de la pantalla (CA-9), sin salirse por
  // ningun borde.
  const caja = await tarjeta(pagina).boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(375 + 1);
  expect(caja!.y).toBeGreaterThanOrEqual(0);
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(667 + 1);

  // El tutorial no agrega scroll horizontal por su cuenta: su capa y su
  // tarjeta se quedan dentro del ancho del viewport. Se mide la contribucion
  // del propio tutorial (capa + tarjeta), no el recuadro resaltado, que sigue
  // al elemento que la pantalla coloque (si la cabecera desborda en movil, eso
  // es un asunto de esa pantalla, no de la tarjeta del tutorial).
  const desborde = await pagina.evaluate(() => {
    const ancho = window.innerWidth;
    return ['.tutorial__capa', '.tutorial__tarjeta'].some((sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().right) > ancho + 1 : false;
    });
  });
  expect(desborde, 'la capa y la tarjeta del tutorial no sobresalen del viewport').toBe(false);

  await contexto.close();
});
