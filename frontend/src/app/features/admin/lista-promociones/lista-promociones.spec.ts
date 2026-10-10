import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ListaPromociones } from './lista-promociones';

registerLocaleData(localeEsCo);

function promocion(sobrescribir: Record<string, unknown> = {}) {
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

function pagina(resultados: unknown[], extra: Record<string, unknown> = {}) {
  return { count: resultados.length, next: null, previous: null, results: resultados, ...extra };
}

describe('ListaPromociones', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaPromociones],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(ListaPromociones);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<ListaPromociones>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<ListaPromociones>) {
    return elemento(fixture).textContent ?? '';
  }

  function pulsar(fixture: ComponentFixture<ListaPromociones>, selector: string) {
    elemento(fixture).querySelector<HTMLButtonElement>(selector)!.click();
  }

  async function conPromociones(resultados: unknown[], extra: Record<string, unknown> = {}) {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/promociones/').flush(pagina(resultados, extra));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide la primera pagina al arrancar', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/promociones/');

    expect(peticion.request.params.get('page')).toBe('1');
  });

  it('muestra una fila por promocion con descuento, fechas y productos', async () => {
    const { fixture } = await conPromociones([promocion()]);

    const fila = elemento(fixture).querySelector('tbody tr')!;
    expect(fila.textContent).toContain('Semana de la res');
    expect(fila.textContent).toContain('20 %');
    expect(fila.textContent).toContain('8 oct');
    expect(fila.textContent).toContain('15 oct');
    expect(fila.textContent).toContain('2');
    expect(fila.querySelector('[title]')?.getAttribute('title')).toBe('Lomo fino, Churrasco');
  });

  it('marca el estado de cada promocion', async () => {
    const { fixture } = await conPromociones([
      promocion({ id: 1, estado: 'vigente' }),
      promocion({ id: 2, estado: 'programada' }),
      promocion({ id: 3, estado: 'vencida' }),
      promocion({ id: 4, estado: 'inactiva' }),
    ]);

    const insignias = [...elemento(fixture).querySelectorAll('.insignia')];
    expect(insignias.map((insignia) => insignia.textContent?.trim())).toEqual([
      'Vigente',
      'Programada',
      'Vencida',
      'Inactiva',
    ]);
    expect(insignias[0].classList).toContain('insignia');
    expect(insignias[0].classList).toContain('insignia--vigente');
  });

  it('cada fila enlaza a la pantalla de edicion', async () => {
    const { fixture } = await conPromociones([promocion({ id: 42 })]);

    const enlace = elemento(fixture).querySelector('.tabla__acciones a');
    expect(enlace?.getAttribute('href')).toBe('/admin/promociones/42/editar');
  });

  it('ofrece crear una promocion y volver a productos', async () => {
    const { fixture } = await conPromociones([]);

    const destinos = [...elemento(fixture).querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(destinos).toContain('/admin/promociones/nueva');
    expect(destinos).toContain('/admin/productos');
  });

  it('avisa cuando no hay promociones', async () => {
    const { fixture } = await conPromociones([]);

    expect(texto(fixture)).toContain('Todavia no hay promociones');
    expect(elemento(fixture).querySelector('table')).toBeNull();
  });

  it('pide confirmacion antes de eliminar', async () => {
    const { fixture, http } = await conPromociones([promocion()]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();

    http.expectNone((r) => r.method === 'DELETE');
    expect(texto(fixture)).toContain('Eliminar Semana de la res?');
  });

  it('al confirmar envia el DELETE y recarga el listado', async () => {
    const { fixture, http } = await conPromociones([promocion({ id: 42 })]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton:not(.boton--secundario)');
    await fixture.whenStable();

    const borrado = http.expectOne('/api/promociones/42/');
    expect(borrado.request.method).toBe('DELETE');
    borrado.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    http.expectOne((r) => r.url === '/api/promociones/' && r.method === 'GET').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Todavia no hay promociones');
  });

  it('avisa cuando no se puede eliminar', async () => {
    const { fixture, http } = await conPromociones([promocion({ id: 42 })]);

    pulsar(fixture, '.boton--peligro');
    await fixture.whenStable();
    pulsar(fixture, '.confirmacion .boton:not(.boton--secundario)');
    await fixture.whenStable();
    http
      .expectOne('/api/promociones/42/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos eliminar la promocion');
  });

  it('avisa que hace falta una cuenta de administrador', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/promociones/')
      .flush({ detail: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('cuenta de administrador');
    expect(elemento(fixture).querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/promociones/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar las promociones');
  });
});
