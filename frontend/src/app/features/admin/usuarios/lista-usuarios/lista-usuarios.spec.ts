import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ListaUsuarios } from './lista-usuarios';

registerLocaleData(localeEsCo);

function usuario(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 3,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@example.com',
    telefono: '3001234567',
    is_active: true,
    is_staff: false,
    date_joined: '2026-01-15T12:00:00Z',
    ...sobrescribir,
  };
}

function pagina(resultados: unknown[], extra: Record<string, unknown> = {}) {
  return { count: resultados.length, next: null, previous: null, results: resultados, ...extra };
}

describe('ListaUsuarios', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaUsuarios],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(ListaUsuarios);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<ListaUsuarios>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<ListaUsuarios>) {
    return elemento(fixture).textContent ?? '';
  }

  async function conUsuarios(resultados: unknown[], extra: Record<string, unknown> = {}) {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/auth/usuarios/').flush(pagina(resultados, extra));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide la primera pagina al arrancar', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/auth/usuarios/');
    expect(peticion.request.params.get('page')).toBe('1');
  });

  it('muestra una fila por usuario con su correo y su estado', async () => {
    const { fixture } = await conUsuarios([usuario()]);

    const texto_ = texto(fixture);
    expect(texto_).toContain('Ana Gomez');
    expect(texto_).toContain('ana@example.com');
    expect(texto_).toContain('Activo');
  });

  it('marca al personal con una insignia aparte', async () => {
    const { fixture } = await conUsuarios([usuario({ is_staff: true })]);

    expect(elemento(fixture).querySelector('.insignia--staff')).toBeTruthy();
  });

  it('desactiva una cuenta sin recargar el listado', async () => {
    const { fixture, http } = await conUsuarios([usuario({ id: 7 })]);

    elemento(fixture).querySelector<HTMLButtonElement>('.insignia--boton')!.click();
    await fixture.whenStable();

    const peticion = http.expectOne('/api/auth/usuarios/7/');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ is_active: false });

    peticion.flush(usuario({ id: 7, is_active: false }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Inactivo');
    http.expectNone((r) => r.url === '/api/auth/usuarios/' && r.method === 'GET');
  });

  it('reactiva una cuenta inactiva', async () => {
    const { fixture, http } = await conUsuarios([usuario({ id: 7, is_active: false })]);

    elemento(fixture).querySelector<HTMLButtonElement>('.insignia--boton')!.click();
    await fixture.whenStable();

    expect(http.expectOne('/api/auth/usuarios/7/').request.body).toEqual({ is_active: true });
  });

  it('avisa cuando no se puede cambiar el estado', async () => {
    const { fixture, http } = await conUsuarios([usuario({ id: 7 })]);

    elemento(fixture).querySelector<HTMLButtonElement>('.insignia--boton')!.click();
    await fixture.whenStable();
    http
      .expectOne('/api/auth/usuarios/7/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cambiar el estado de la cuenta');
  });

  it('avisa cuando no hay usuarios', async () => {
    const { fixture } = await conUsuarios([]);

    expect(texto(fixture)).toContain('Todavia no hay clientes registrados');
    expect(elemento(fixture).querySelector('table')).toBeNull();
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne((r) => r.url === '/api/auth/usuarios/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar los usuarios');
  });
});
