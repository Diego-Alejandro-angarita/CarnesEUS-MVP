import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Catalogo } from './catalogo';

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

const CATEGORIAS = [
  { id: 1, nombre: 'Res', slug: 'res' },
  { id: 2, nombre: 'Cerdo', slug: 'cerdo' },
];

describe('Catalogo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function flushCategorias(http: HttpTestingController, categorias: unknown[] = CATEGORIAS) {
    http.expectOne((r) => r.url === '/api/categorias/').flush(categorias);
  }

  function crear() {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);
    return { fixture, http };
  }

  function texto(fixture: { nativeElement: unknown }) {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('pide la primera pagina al arrancar', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.get('page')).toBe('1');
    expect(peticion.request.params.get('page_size')).toBe('12');
  });

  it('muestra foto, precio y disponibilidad de cada producto', async () => {
    const { fixture, http } = crear();

    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([producto()]));
    await fixture.whenStable();
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    const foto = elemento.querySelector('img');
    expect(foto?.getAttribute('src')).toBe('https://ejemplo.test/lomo-fino.jpg');
    expect(foto?.getAttribute('alt')).toBe('Lomo fino');
    expect(texto(fixture)).toContain('38.900');
    expect(texto(fixture)).toContain('Disponible');
  });

  it('marca como agotados los productos no disponibles', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/productos/')
      .flush(pagina([producto({ disponible: false })]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Agotado');
    expect((fixture.nativeElement as HTMLElement).querySelector('.tarjeta--agotada')).toBeTruthy();
  });

  it('muestra la paginacion cuando hay mas de una pagina', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/productos/')
      .flush(pagina([producto()], { count: 25, next: '/api/productos/?page=2' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll('.paginacion button');
    expect(texto(fixture)).toContain('Pagina 1 de 3');
    expect((botones[0] as HTMLButtonElement).disabled).toBe(true);
    expect((botones[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('avisa cuando el catalogo esta vacio', async () => {
    const { fixture, http } = crear();

    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Todavia no hay productos');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/productos/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar el catalogo');
  });

  it('no manda el parametro search si no hay termino de busqueda', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.has('search')).toBe(false);
  });

  it('deja el campo de busqueda vacio cuando el query param desaparece (queda undefined)', () => {
    const fixture = TestBed.createComponent(Catalogo);
    // El binding de inputs del router deja el input en undefined cuando el
    // query param ya no esta en la URL, en vez de volver al valor por defecto.
    fixture.componentRef.setInput('busqueda', undefined);
    fixture.detectChanges();
    flushCategorias(TestBed.inject(HttpTestingController));

    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.busqueda input',
    )!;
    expect(campo.value).toBe('');
  });

  it('manda el parametro search cuando hay un termino de busqueda', () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('busqueda', 'lomo');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.get('search')).toBe('lomo');
  });

  it('al enviar el formulario de busqueda navega con el query param busqueda', async () => {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([producto()]));
    await fixture.whenStable();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');

    const elemento = fixture.nativeElement as HTMLElement;
    const campo = elemento.querySelector<HTMLInputElement>('.busqueda input')!;
    campo.value = 'lomo';
    elemento.querySelector('form.busqueda')?.dispatchEvent(new Event('submit'));

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { busqueda: 'lomo', page: null } }),
    );
  });

  it('avisa con un mensaje distinto cuando la busqueda no tiene coincidencias', async () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('busqueda', 'chorizo');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);

    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No encontramos productos que coincidan con "chorizo"');
  });

  it('llena el selector de categorias con lo que devuelve el backend', async () => {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    (elemento.querySelector<HTMLButtonElement>('.boton-filtros'))!.click();
    fixture.detectChanges();

    const opciones = elemento.querySelectorAll('#filtro-categoria option');
    expect(opciones.length).toBe(3);
    expect(opciones[1].textContent).toContain('Res');
    expect(opciones[2].textContent).toContain('Cerdo');
  });

  it('no manda categoria ni precio si no hay filtros activos', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.has('categoria')).toBe(false);
    expect(peticion.request.params.has('precio_min')).toBe(false);
    expect(peticion.request.params.has('precio_max')).toBe(false);
  });

  it('manda categoria y rango de precio cuando hay filtros activos', () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('categoria', 2);
    fixture.componentRef.setInput('precio_min', 20000);
    fixture.componentRef.setInput('precio_max', 50000);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);

    const peticion = http.expectOne((r) => r.url === '/api/productos/');

    expect(peticion.request.params.get('categoria')).toBe('2');
    expect(peticion.request.params.get('precio_min')).toBe('20000');
    expect(peticion.request.params.get('precio_max')).toBe('50000');
  });

  it('al aplicar el panel de filtros navega con los query params correctos', async () => {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([producto()]));
    await fixture.whenStable();
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    elemento.querySelector<HTMLButtonElement>('.boton-filtros')!.click();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');

    const categoriaSel = elemento.querySelector<HTMLSelectElement>('#filtro-categoria')!;
    categoriaSel.value = '2';
    const precioMinCampo = elemento.querySelector<HTMLInputElement>('#filtro-precio-min')!;
    precioMinCampo.value = '10000';
    elemento.querySelector('form.panel-filtros')?.dispatchEvent(new Event('submit'));

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { categoria: '2', precio_min: '10000', precio_max: null, page: null },
      }),
    );
  });

  it('limpiar filtros navega quitando categoria y precio', async () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('categoria', 2);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);
    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([producto()]));
    await fixture.whenStable();
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    elemento.querySelector<HTMLButtonElement>('.boton-filtros')!.click();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');

    elemento.querySelector<HTMLButtonElement>('.boton-texto')!.click();

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { categoria: null, precio_min: null, precio_max: null, page: null },
      }),
    );
  });

  it('avisa con un mensaje distinto cuando el filtro no tiene coincidencias', async () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('precio_min', 999999);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushCategorias(http);

    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No encontramos productos con esos filtros.');
  });
});
