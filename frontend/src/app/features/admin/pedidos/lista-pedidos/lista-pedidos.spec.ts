import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ListaPedidos } from './lista-pedidos';

registerLocaleData(localeEsCo);

function fila(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 15,
    nombre: 'Ana Gomez',
    municipio: 'Medellin',
    barrio: 'Laureles',
    estado: 'por_confirmar',
    etapa: 'recibido',
    total: '77800.00',
    metodo_pago: 'Transferencia',
    creado_en: '2026-10-08T12:00:00Z',
    ...sobrescribir,
  };
}

function pagina(resultados: unknown[], extra: Record<string, unknown> = {}) {
  return { count: resultados.length, next: null, previous: null, results: resultados, ...extra };
}

describe('ListaPedidos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaPedidos],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(ListaPedidos);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<ListaPedidos>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<ListaPedidos>) {
    return elemento(fixture).textContent ?? '';
  }

  async function conPedidos(resultados: unknown[], extra: Record<string, unknown> = {}) {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/pedidos/admin/').flush(pagina(resultados, extra));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide la primera pagina al arrancar', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/pedidos/admin/');

    expect(peticion.request.params.get('page')).toBe('1');
    expect(peticion.request.params.has('estado')).toBe(false);
  });

  it('muestra una fila por pedido con su estado y total', async () => {
    const { fixture } = await conPedidos([fila()]);

    const filas = elemento(fixture).querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
    expect(texto(fixture)).toContain('Ana Gomez');
    expect(texto(fixture)).toContain('Laureles, Medellin');
    expect(texto(fixture)).toContain('Transferencia');
    expect(texto(fixture)).toContain('Por confirmar');
    expect(texto(fixture)).toContain('77.800');
  });

  it('enlaza cada fila al detalle del pedido', async () => {
    const { fixture } = await conPedidos([fila({ id: 42 })]);

    const enlace = elemento(fixture).querySelector('.tabla__acciones a');
    expect(enlace?.getAttribute('href')).toBe('/admin/pedidos/42');
  });

  it('avisa cuando no hay pedidos', async () => {
    const { fixture } = await conPedidos([]);

    expect(texto(fixture)).toContain('No hay pedidos');
    expect(elemento(fixture).querySelector('table')).toBeNull();
  });

  it('filtra por estado y vuelve a la primera pagina', async () => {
    const { fixture } = await conPedidos([fila()]);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');

    const selector = elemento(fixture).querySelector<HTMLSelectElement>('#filtro-estado')!;
    selector.value = 'pagado';
    selector.dispatchEvent(new Event('change'));

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { estado: 'pagado', page: null } }),
    );
  });

  it('muestra la etapa de cada pedido', async () => {
    const { fixture } = await conPedidos([fila({ etapa: 'en_camino' })]);

    expect(elemento(fixture).querySelector('tbody .insignia--en_camino')?.textContent).toContain(
      'En camino',
    );
  });

  it('filtra por etapa y vuelve a la primera pagina', async () => {
    const { fixture } = await conPedidos([fila()]);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');

    const selector = elemento(fixture).querySelector<HTMLSelectElement>('#filtro-etapa')!;
    selector.value = 'entregado';
    selector.dispatchEvent(new Event('change'));

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { etapa: 'entregado', page: null } }),
    );
  });

  it('envia el filtro de etapa al backend', () => {
    const fixture = TestBed.createComponent(ListaPedidos);
    fixture.componentRef.setInput('etapa', 'en_preparacion');
    fixture.detectChanges();

    const peticion = TestBed.inject(HttpTestingController).expectOne(
      (r) => r.url === '/api/pedidos/admin/',
    );
    expect(peticion.request.params.get('etapa')).toBe('en_preparacion');
  });

  it('muestra la paginacion cuando hay mas de una pagina', async () => {
    const { fixture } = await conPedidos([fila()], { count: 25, next: '/api/pedidos/admin/?page=2' });

    expect(texto(fixture)).toContain('Pagina 1 de 2');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/pedidos/admin/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar los pedidos');
  });
});
