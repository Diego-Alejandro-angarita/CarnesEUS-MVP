import { Page, expect, test } from '@playwright/test';

/**
 * FR-09 Cambiar disponibilidad: pruebas E2E.
 *
 * El administrador pulsa la etiqueta Disponible / Agotado del listado y el
 * cambio tiene que llegar hasta el catalogo que ve el cliente.
 */

interface ProductoCreado {
  id: number;
  nombre: string;
}

// Por el proxy de Angular: asi viaja la sesion de personal que deja
// personal.setup.ts, que es la que piden crear y eliminar (FR-19).
const API = '/api';

/** Django pide el token CSRF en las peticiones que modifican algo. */
async function cabeceraCsrf(page: Page) {
  const cookies = await page.context().cookies();
  return { 'X-CSRFToken': cookies.find((c) => c.name === 'csrftoken')?.value ?? '' };
}

/**
 * Crea un producto propio para la prueba. El "000" lo pone de primero en el
 * listado de administracion, que ordena los disponibles por nombre.
 */
async function crearProducto(page: Page): Promise<ProductoCreado> {
  const categorias = await (await page.request.get(`${API}/categorias/`)).json();
  expect(categorias.length, 'Sin categorias: corre "manage.py cargar_catalogo"').toBeGreaterThan(0);

  const nombre = `000 E2E Lomo ${Date.now()}`;
  const respuesta = await page.request.post(`${API}/productos/`, {
    headers: await cabeceraCsrf(page),
    data: {
      categoria: categorias[0].id,
      nombre,
      presentacion: 'Bandeja 500 g',
      precio: 38900,
      disponible: true,
    },
  });
  expect(respuesta.status()).toBe(201);
  return { id: (await respuesta.json()).id, nombre };
}

let producto: ProductoCreado;

test.beforeEach(async ({ page }) => {
  producto = await crearProducto(page);
});

test.afterEach(async ({ page }) => {
  // Eliminar archiva: el producto deja de verse en el catalogo y el listado.
  await page.request.delete(`${API}/productos/${producto.id}/`, {
    headers: await cabeceraCsrf(page),
  });
});

test('agotar un producto desde el listado lo marca como agotado en el catalogo', async ({
  page,
}) => {
  await page.goto('/admin/productos');

  const etiqueta = page.getByRole('button', { name: `marcar ${producto.nombre} como agotado` });
  await expect(etiqueta).toHaveText(/Disponible/);
  await etiqueta.click();

  const etiquetaAgotado = page.getByRole('button', {
    name: `marcar ${producto.nombre} como disponible`,
  });
  await expect(etiquetaAgotado).toHaveText(/Agotado/);

  // El cliente lo sigue viendo en el catalogo, pero marcado como agotado.
  await page.goto('/productos');
  await page.getByLabel('Buscar productos').fill(producto.nombre);
  await page.getByRole('button', { name: 'Buscar' }).click();

  const tarjeta = page.locator('.tarjeta', { hasText: producto.nombre });
  await expect(tarjeta).toHaveCount(1);
  await expect(tarjeta).toHaveClass(/tarjeta--agotada/);
  await expect(tarjeta.locator('.insignia').first()).toHaveText('Agotado');
});

test('si el servidor falla, avisa y el producto sigue disponible', async ({ page }) => {
  // Solo se intercepta el cambio de disponibilidad; el resto va al backend real.
  await page.route(`**/api/productos/${producto.id}/`, (ruta) =>
    ruta.request().method() === 'PATCH'
      ? ruta.fulfill({ status: 500, body: 'Error del servidor' })
      : ruta.continue(),
  );
  await page.goto('/admin/productos');

  const etiqueta = page.getByRole('button', { name: `marcar ${producto.nombre} como agotado` });
  await etiqueta.click();

  await expect(page.getByRole('alert')).toHaveText(
    'No pudimos cambiar la disponibilidad. Intentalo de nuevo.',
  );
  await expect(etiqueta).toHaveText(/Disponible/);
  await expect(etiqueta).toBeEnabled();

  const guardado = await (await page.request.get(`${API}/productos/${producto.id}/`)).json();
  expect(guardado.disponible).toBe(true);
});
