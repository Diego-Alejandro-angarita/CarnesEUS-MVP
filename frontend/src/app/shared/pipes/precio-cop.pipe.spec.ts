import { PrecioCopPipe } from './precio-cop.pipe';

describe('PrecioCopPipe', () => {
  const pipe = new PrecioCopPipe();

  /** Se compara sin espacios: el separador de miles es un espacio especial. */
  const normalizar = (texto: string) => texto.replace(/\s/g, ' ');

  it('formatea un precio en pesos sin decimales', () => {
    expect(normalizar(pipe.transform('52000.00'))).toContain('52.000');
  });

  it('acepta numeros y no solo texto', () => {
    expect(normalizar(pipe.transform(112000))).toContain('112.000');
  });

  it('devuelve vacio cuando no hay valor', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('devuelve vacio si el valor no es un numero', () => {
    expect(pipe.transform('no-es-un-precio')).toBe('');
  });
});
