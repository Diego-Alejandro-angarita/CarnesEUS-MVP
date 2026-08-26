import { HttpErrorResponse } from '@angular/common/http';

import { mensajeDeError } from './mensajes';

/**
 * DRF devuelve los errores en varias formas. Si esta funcion se equivoca, el
 * usuario ve "[object Object]" en pantalla en vez de que le falta el telefono.
 */
describe('mensajeDeError', () => {
  const respuesta = (error: unknown, status = 400) =>
    new HttpErrorResponse({ error, status });

  it('lee la forma {detail}', () => {
    expect(mensajeDeError(respuesta({ detail: 'Este pedido ya fue pagado.' }))).toBe(
      'Este pedido ya fue pagado.',
    );
  });

  it('lee los errores por campo del serializador', () => {
    const mensaje = mensajeDeError(
      respuesta({ password2: ['Las contrasenas no coinciden.'] }),
    );
    expect(mensaje).toBe('Las contrasenas no coinciden.');
  });

  it('junta varios campos con error', () => {
    const mensaje = mensajeDeError(
      respuesta({ email: ['Ya existe una cuenta.'], password: ['Es muy corta.'] }),
    );
    expect(mensaje).toContain('Ya existe una cuenta.');
    expect(mensaje).toContain('Es muy corta.');
  });

  it('avisa distinto cuando el backend no responde', () => {
    expect(mensajeDeError(respuesta(null, 0))).toContain('No se pudo conectar');
  });

  it('cae al mensaje por defecto si el cuerpo no aporta nada', () => {
    expect(mensajeDeError(respuesta({}), 'Fallo el pago.')).toBe('Fallo el pago.');
  });

  it('tolera errores que no son respuestas HTTP', () => {
    expect(mensajeDeError(new Error('boom'), 'Por defecto.')).toBe('Por defecto.');
  });
});
