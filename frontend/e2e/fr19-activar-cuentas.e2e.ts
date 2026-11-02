import { Browser, Page, expect, test } from '@playwright/test';

/**
 * FR-19 Activar y desactivar cuentas: pruebas E2E.
 *
 * El personal pulsa la etiqueta Activo / Inactivo del listado de usuarios y el
 * cliente de esa cuenta, en su propio navegador, tiene que quedarse fuera (o
 * poder volver a entrar).
 */

const CLAVE = 'UnaClaveSegura123';

/**
 * Cliente nuevo por prueba, para no depender de lo que haya en la base. Se
 * registra desde su propio navegador, como lo haria en la tienda.
 */
async function registrarCliente(page: Page): Promise<string> {
  const email = `e2e-cliente-${Date.now()}@carneseus.test`;
  const respuesta = await page.request.post('/api/auth/registro/', {
    data: {
      first_name: 'Cliente',
      last_name: 'E2E',
      email,
      telefono: '3001234567',
      password: CLAVE,
      password_confirmacion: CLAVE,
    },
  });
  expect(respuesta.status()).toBe(201);
  return email;
}

/** Navegador aparte, sin la sesion de personal: el del cliente. */
async function navegadorDelCliente(browser: Browser) {
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return { contexto, pagina: await contexto.newPage() };
}

async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electronico').fill(email);
  await page.getByLabel('Contrasena', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Pulsa la etiqueta de la cuenta en el listado y espera el nuevo estado. */
async function cambiarEstado(page: Page, email: string, a: 'activo' | 'inactivo') {
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: `marcar ${email} como ${a}` }).click();
  const contrario = a === 'activo' ? 'inactivo' : 'activo';
  await expect(page.getByRole('button', { name: `marcar ${email} como ${contrario}` })).toHaveText(
    a === 'activo' ? /Activo/ : /Inactivo/,
  );
}

test('desactivar una cuenta saca al cliente y le impide volver a entrar', async ({
  page,
  browser,
}) => {
  const { contexto, pagina: cliente } = await navegadorDelCliente(browser);
  const email = await registrarCliente(cliente);

  await iniciarSesion(cliente, email);
  await expect(cliente).toHaveURL(/\/productos/);
  expect((await cliente.request.get('/api/auth/quien-soy/')).status()).toBe(200);

  await cambiarEstado(page, email, 'inactivo');

  // La sesion que ya tenia abierta deja de valer...
  expect((await cliente.request.get('/api/auth/quien-soy/')).status()).toBe(403);

  // ...y tampoco puede abrir una nueva.
  await iniciarSesion(cliente, email);
  await expect(cliente.locator('.mensaje--error')).toBeVisible();
  await expect(cliente).toHaveURL(/\/login/);

  await contexto.close();
});

test('reactivar la cuenta le devuelve el acceso al cliente', async ({ page, browser }) => {
  const { contexto, pagina: cliente } = await navegadorDelCliente(browser);
  const email = await registrarCliente(cliente);
  await cambiarEstado(page, email, 'inactivo');

  await cambiarEstado(page, email, 'activo');

  await iniciarSesion(cliente, email);
  await expect(cliente).toHaveURL(/\/productos/);
  expect((await cliente.request.get('/api/auth/quien-soy/')).status()).toBe(200);

  await contexto.close();
});

/** Pagina del listado donde aparece una cuenta: cada prueba suma clientes nuevos arriba. */
async function paginaDe(page: Page, id: number): Promise<number> {
  for (let numero = 1; ; numero++) {
    const datos = await (
      await page.request.get(`/api/auth/usuarios/?page=${numero}&page_size=20`)
    ).json();
    if (datos.results.some((usuario: { id: number }) => usuario.id === id)) return numero;
    expect(datos.next, `La cuenta ${id} no esta en el listado`).not.toBeNull();
  }
}

test('el personal no puede desactivar su propia cuenta desde el listado', async ({ page }) => {
  const yo = await (await page.request.get('/api/auth/quien-soy/')).json();
  await page.goto(`/admin/usuarios?page=${await paginaDe(page, yo.id)}`);

  const propia = page.getByRole('button', { name: /es tu cuenta, no puedes desactivarla/ });
  await expect(propia).toBeDisabled();
  await expect(page.getByText('Tu cuenta', { exact: true })).toBeVisible();
});
