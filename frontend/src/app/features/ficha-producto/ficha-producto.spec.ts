import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { ComponentRef, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FichaProducto } from './ficha-producto';

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

describe('FichaProducto', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FichaProducto],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear(slug = 'lomo-fino') {
    const fixture = TestBed.createComponent(FichaProducto);
    (fixture.componentRef as ComponentRef<FichaProducto>).setInput('slug', slug);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function texto(fixture: { nativeElement: unknown }) {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('pide el producto por su slug', () => {
    const { http } = crear('lomo-fino');

    http.expectOne('/api/productos/lomo-fino/');
  });

  it('muestra el detalle cuando la API responde', async () => {
    const { fixture, http } = crear();

    http.expectOne('/api/productos/lomo-fino/').flush(producto());
    await fixture.whenStable();
    fixture.detectChanges();

    const texto_ = texto(fixture);
    expect(texto_).toContain('Lomo fino');
    expect(texto_).toContain('Corte magro y suave.');
    expect(texto_).toContain('38.900');
    expect(texto_).toContain('Disponible');
  });

  it('avisa cuando el producto no existe', async () => {
    const { fixture, http } = crear('no-existe');

    http
      .expectOne('/api/productos/no-existe/')
      .flush('no encontrado', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No encontramos este producto');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne('/api/productos/lomo-fino/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar el producto');
  });
});
