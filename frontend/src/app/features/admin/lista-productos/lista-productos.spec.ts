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

  function pulsar(fixture: ComponentFixture<ListaProductos>, selector: string) {
    elemento(fixture).querySelector<HTMLButtonElement>(selector)!.click();
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

  it('el estado es un boton que dice que hara al pulsarlo', async () => {
    const { fixture } = await conProductos([producto()]);

    const boton = elemento(fixture).querySelector<HTMLButtonElement>('.insignia--boton')!;
    expect(boton.tagName).toBe('BUTTON');
    expect(boton.textContent).toContain('Disponible');
    expect(boton.textContent).toContain('marcar Lomo fino como agotado');
  });

  it('agota el producto sin salir del listado', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42 })]);

    pulsar(fixture, '.insignia--boton');
    await fixture.whenStable();

    const peticion = http.expectOne('/api/productos/42/');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ disponible: false });

    peticion.flush({ ...producto({ id: 42 }), disponible: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(elemento(fixture).querySelector('.insignia--agotado')).toBeTruthy();
    expect(texto(fixture)).toContain('Agotado');
  });

  it('repone un producto agotado', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42, disponible: false })]);

    pulsar(fixture, '.insignia--boton');
    await fixture.whenStable();

    expect(http.expectOne('/api/productos/42/').request.body).toEqual({ disponible: true });
  });

  it('no recarga el listado al cambiar la disponibilidad', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42 })]);

    pulsar(fixture, '.insignia--boton');
    await fixture.whenStable();
    http.expectOne('/api/productos/42/').flush({ ...producto({ id: 42 }), disponible: false });
    await fixture.whenStable();

    // La fila se actualiza en su sitio: recargar la moveria de posicion.
    http.expectNone((r) => r.url === '/api/productos/' && r.method === 'GET');
  });

  it('avisa cuando no se puede cambiar la disponibilidad', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42 })]);

    pulsar(fixture, '.insignia--boton');
    await fixture.whenStable();
    http
      .expectOne('/api/productos/42/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cambiar la disponibilidad');
    expect(texto(fixture)).toContain('Disponible');
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
  it('ofrece eliminar cada producto', async () => {
    const { fixture } = await conProductos([producto()]);

    const boton = elemento(fixture).querySelector('.boton--peligro');
    expect(boton?.textContent).toContain('Eliminar');
  });

  it('pide confirmacion antes de eliminar nada', async () => {
    const { fixture, http } = await conProductos([producto()]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();

    http.expectNone((r) => r.method === 'DELETE');
    expect(texto(fixture)).toContain('Eliminar Lomo fino?');
    expect(elemento(fixture).querySelector('.boton--peligro')).toBeNull();
  });

  it('cancelar deja el producto en su sitio', async () => {
    const { fixture, http } = await conProductos([producto()]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton--secundario');
    await fixture.whenStable();

    http.expectNone((r) => r.method === 'DELETE');
    expect(elemento(fixture).querySelector('.boton--peligro')).toBeTruthy();
    expect(texto(fixture)).not.toContain('Eliminar Lomo fino?');
  });

  it('al confirmar envia el DELETE y recarga el listado', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42 })]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton:not(.boton--secundario)');
    await fixture.whenStable();

    const borrado = http.expectOne('/api/productos/42/');
    expect(borrado.request.method).toBe('DELETE');
    borrado.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    http.expectOne((r) => r.url === '/api/productos/' && r.method === 'GET').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Todavia no hay productos');
  });

  it('avisa cuando el backend no puede eliminar', async () => {
    const { fixture, http } = await conProductos([producto({ id: 42 })]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton:not(.boton--secundario)');
    await fixture.whenStable();

    http
      .expectOne('/api/productos/42/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos eliminar el producto');
  });
  it('retrocede de pagina al eliminar el ultimo producto que quedaba en ella', async () => {
    const fixture = TestBed.createComponent(ListaProductos);
    fixture.componentRef.setInput('page', 2);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

    http
      .expectOne((r) => r.url === '/api/productos/')
      .flush(pagina([producto({ id: 42 })], { count: 13, previous: '/api/productos/' }));
    await fixture.whenStable();
    fixture.detectChanges();

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton:not(.boton--secundario)');
    await fixture.whenStable();
    http.expectOne('/api/productos/42/').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    // No recarga la pagina 2, que ya no existe: navega a la anterior.
    http.expectNone((r) => r.url === '/api/productos/' && r.method === 'GET');
  });
});
