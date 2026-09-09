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

  function crear() {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
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

  it('manda el parametro search cuando hay un termino de busqueda', () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.componentRef.setInput('busqueda', 'lomo');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

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

    http.expectOne((r) => r.url === '/api/productos/').flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No encontramos productos que coincidan con "chorizo"');
  });
});
