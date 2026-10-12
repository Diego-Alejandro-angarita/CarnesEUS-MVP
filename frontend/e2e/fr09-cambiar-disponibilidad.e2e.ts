import { APIRequestContext, expect, test } from '@playwright/test';

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

const API = 'http://127.0.0.1:8001/api';

/**
 * Crea un producto propio para la prueba. El "000" lo pone de primero en el
 * listado de administracion, que ordena los disponibles por nombre.
 */
async function crearProducto(request: APIRequestContext): Promise<ProductoCreado> {
  const categorias = await (await request.get(`${API}/categorias/`)).json();
  expect(categorias.length, 'Sin categorias: corre "manage.py cargar_catalogo"').toBeGreaterThan(0);

  const nombre = `000 E2E Lomo ${Date.now()}`;
  const respuesta = await request.post(`${API}/productos/`, {
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

test.beforeEach(async ({ request }) => {
  producto = await crearProducto(request);
});

test.afterEach(async ({ request }) => {
  // Eliminar archiva: el producto deja de verse en el catalogo y el listado.
  await request.delete(`${API}/productos/${producto.id}/`);
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

test('si el servidor falla, avisa y el producto sigue disponible', async ({ page, request }) => {
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

  const guardado = await (await request.get(`${API}/productos/${producto.id}/`)).json();
  expect(guardado.disponible).toBe(true);
});
