import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CrearPromocion } from './crear-promocion';

registerLocaleData(localeEsCo);

const PRODUCTOS = [
  { id: 1, nombre: 'Lomo fino', categoria: 'Res', precio: '38900.00' },
  { id: 2, nombre: 'Churrasco', categoria: 'Res', precio: '29900.00' },
  { id: 3, nombre: 'Pernil deshuesado', categoria: 'Cerdo', precio: '45900.00' },
];

function creada(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Semana de la res',
    porcentaje: 20,
    fecha_inicio: '2026-10-08',
    fecha_fin: '2026-10-15',
    activa: true,
    productos: [1, 2],
    productos_detalle: [
      { id: 1, nombre: 'Lomo fino' },
      { id: 2, nombre: 'Churrasco' },
    ],
    estado: 'vigente',
    ...sobrescribir,
  };
}

describe('CrearPromocion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPromocion],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(CrearPromocion);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  /** Responde la peticion de productos y deja el formulario pintado. */
  async function conFormulario(productos: unknown[] = PRODUCTOS) {
    const { fixture, http } = crear();
    http.expectOne('/api/promociones/productos/').flush(productos);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function elemento(fixture: ComponentFixture<CrearPromocion>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<CrearPromocion>) {
    return elemento(fixture).textContent ?? '';
  }

  function escribir(fixture: ComponentFixture<CrearPromocion>, selector: string, valor: string) {
    const campo = elemento(fixture).querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function casillas(fixture: ComponentFixture<CrearPromocion>) {
    return [...elemento(fixture).querySelectorAll<HTMLInputElement>('.selector__lista input')];
  }

  async function marcar(fixture: ComponentFixture<CrearPromocion>, indice: number) {
    const casilla = casillas(fixture)[indice];
    casilla.checked = true;
    casilla.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  /** Rellena todos los campos con datos validos y elige los dos primeros cortes. */
  async function rellenar(fixture: ComponentFixture<CrearPromocion>) {
    escribir(fixture, '#nombre', 'Semana de la res');
    escribir(fixture, '#porcentaje', '20');
    escribir(fixture, '#fecha_inicio', '2026-10-08');
    escribir(fixture, '#fecha_fin', '2026-10-15');
    await marcar(fixture, 0);
    await marcar(fixture, 1);
  }

  // Sin zone.js: se espera a whenStable() para que la prueba falle si el
  // componente no programa el refresco por su cuenta.
  async function enviar(fixture: ComponentFixture<CrearPromocion>) {
    elemento(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('pide los productos para el selector al arrancar', () => {
    const { http } = crear();

    expect(http.expectOne('/api/promociones/productos/').request.method).toBe('GET');
  });

  it('ofrece cada producto con su categoria y precio', async () => {
    const { fixture } = await conFormulario();

    expect(casillas(fixture).length).toBe(3);
    expect(texto(fixture)).toContain('Pernil deshuesado');
    expect(texto(fixture)).toContain('Cerdo');
    expect(texto(fixture)).toContain('45.900');
    expect(texto(fixture)).toContain('0 elegidos');
  });

  it('filtra la lista de productos sin perder los ya elegidos', async () => {
    const { fixture } = await conFormulario();

    await marcar(fixture, 0);
    escribir(fixture, '.selector__filtro', 'cerdo');
    await fixture.whenStable();

    expect(casillas(fixture).length).toBe(1);
    expect(texto(fixture)).toContain('Pernil deshuesado');
    expect(texto(fixture)).toContain('1 elegido');
  });

  it('no envia nada si faltan datos y marca los errores', async () => {
    const { fixture, http } = await conFormulario();

    await enviar(fixture);

    http.expectNone('/api/promociones/');
    expect(texto(fixture)).toContain('Este campo es obligatorio.');
    expect(texto(fixture)).toContain('Elige una fecha.');
    expect(texto(fixture)).toContain('Elige al menos un producto.');
  });

  it('rechaza un descuento fuera de 1 a 99 sin llamar al backend', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    escribir(fixture, '#porcentaje', '100');
    await enviar(fixture);

    http.expectNone('/api/promociones/');
    expect(texto(fixture)).toContain('El descuento debe estar entre 1 y 99 por ciento.');
  });

  it('rechaza una fecha de fin anterior a la de inicio', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    escribir(fixture, '#fecha_fin', '2026-10-01');
    await enviar(fixture);

    http.expectNone('/api/promociones/');
    expect(texto(fixture)).toContain('La fecha de fin no puede ser anterior a la de inicio.');
  });

  it('envia la promocion con los productos elegidos', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);

    const peticion = http.expectOne('/api/promociones/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombre: 'Semana de la res',
      porcentaje: 20,
      fecha_inicio: '2026-10-08',
      fecha_fin: '2026-10-15',
      activa: true,
      productos: [1, 2],
    });
  });

  it('confirma la creacion y permite crear otra', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http.expectOne('/api/promociones/').flush(creada(), { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Promocion creada');
    expect(texto(fixture)).toContain('Semana de la res');
    expect(texto(fixture)).toContain('2 productos');

    elemento(fixture).querySelector<HTMLButtonElement>('.exito button')!.click();
    await fixture.whenStable();

    expect(elemento(fixture).querySelector<HTMLInputElement>('#nombre')!.value).toBe('');
    expect(casillas(fixture).some((casilla) => casilla.checked)).toBe(false);
  });

  it('muestra bajo cada campo los errores que devuelve el backend', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http
      .expectOne('/api/promociones/')
      .flush(
        { productos: ['El producto 2 no existe o ya no esta en el catalogo.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El producto 2 no existe');
    expect(elemento(fixture).querySelector('form')).toBeTruthy();
  });

  it('avisa que hace falta una cuenta de administrador', async () => {
    const { fixture, http } = crear();

    http
      .expectOne('/api/promociones/productos/')
      .flush({ detail: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('cuenta de administrador');
    expect(elemento(fixture).querySelector('a[href="/login"]')).toBeTruthy();
    expect(elemento(fixture).querySelector('form')).toBeNull();
  });

  it('avisa cuando todavia no hay productos', async () => {
    const { fixture } = await conFormulario([]);

    expect(texto(fixture)).toContain('Todavia no hay productos en el catalogo');
    expect(elemento(fixture).querySelector('form')).toBeNull();
  });

  it('avisa cuando el backend no responde al guardar', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http
      .expectOne('/api/promociones/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos guardar la promocion');
  });
});
