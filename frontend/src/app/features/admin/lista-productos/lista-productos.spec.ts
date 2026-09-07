import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ListaProductos } from './lista-productos';

registerLocaleData(localeEsCo);

function producto(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Lomo fino',
    slug: 'lomo-fino',
    descripcion: 'Corte magro y suave.',
    presentacion: 'Bandeja 500 g',
    precio: '38900.00',
    foto_url: 'https://ejemplo.test/lomo-fino.jpg',
    disponible: true,
    categoria: 'Res',
    ...sobrescribir,
  };
}

function pagina(resultados: unknown[], extra: Record<string, unknown> = {}) {
  return { count: resultados.length, next: null, previous: null, results: resultados, ...extra };
}

describe('ListaProductos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaProductos],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(ListaProductos);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<ListaProductos>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<ListaProductos>) {
    return elemento(fixture).textContent ?? '';
  }

  async function conProductos(resultados: unknown[], extra: Record<string, unknown> = {}) {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/productos/').flush(pagina(resultados, extra));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide la primera pagina al arrancar', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.get('page')).toBe('1');
  });

  it('muestra una fila por producto con su precio y su estado', async () => {
    const { fixture } = await conProductos([producto()]);

    const filas = elemento(fixture).querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
    expect(texto(fixture)).toContain('Lomo fino');
    expect(texto(fixture)).toContain('Res');
    expect(texto(fixture)).toContain('38.900');
    expect(texto(fixture)).toContain('Disponible');
  });

  it('marca los productos agotados', async () => {
    const { fixture } = await conProductos([producto({ disponible: false })]);

    expect(texto(fixture)).toContain('Agotado');
    expect(elemento(fixture).querySelector('.insignia--agotado')).toBeTruthy();
  });

  it('cada fila enlaza a la pantalla de edicion de ese producto', async () => {
    const { fixture } = await conProductos([producto({ id: 42 })]);

    const enlace = elemento(fixture).querySelector('.tabla__acciones a');
    expect(enlace?.getAttribute('href')).toBe('/admin/productos/42/editar');
  });

  it('ofrece crear un producto nuevo', async () => {
    const { fixture } = await conProductos([producto()]);

    const enlaces = [...elemento(fixture).querySelectorAll('a')];
    expect(enlaces.some((a) => a.getAttribute('href') === '/admin/productos/nuevo')).toBe(true);
  });

  it('avisa cuando no hay productos', async () => {
    const { fixture } = await conProductos([]);

    expect(texto(fixture)).toContain('Todavia no hay productos');
    expect(elemento(fixture).querySelector('table')).toBeNull();
  });

  it('muestra la paginacion cuando hay mas de una pagina', async () => {
    const { fixture } = await conProductos([producto()], {
      count: 25,
      next: '/api/productos/?page=2',
    });

    expect(texto(fixture)).toContain('Pagina 1 de 3');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/productos/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar los productos');
  });
});
