import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';

function usuario(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@example.com',
    telefono: '',
    ...sobrescribir,
  };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function crearSinSesion() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/auth/quien-soy/')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    return { fixture, http };
  }

  function texto(fixture: { nativeElement: unknown }) {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('se construye', () => {
    const { fixture } = crearSinSesion();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra la marca enlazada al catalogo', () => {
    const { fixture } = crearSinSesion();

    const marca = (fixture.nativeElement as HTMLElement).querySelector('.cabecera__marca');
    expect(marca?.textContent).toContain('CarnesEUs');
    expect(marca?.getAttribute('href')).toBe('/productos');
  });

  it('muestra los enlaces de invitado cuando no hay sesion activa', () => {
    const { fixture } = crearSinSesion();

    expect(texto(fixture)).toContain('Iniciar sesion');
    expect(texto(fixture)).toContain('Crear cuenta');
  });

  it('muestra el usuario y el boton de salir cuando hay sesion activa', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/quien-soy/').flush(usuario());
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Ana');
    expect(texto(fixture)).toContain('Salir');
    expect(texto(fixture)).not.toContain('Iniciar sesion');
  });

  it('al salir, cierra la sesion y vuelve a mostrar los enlaces de invitado', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/quien-soy/').flush(usuario());
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.cabecera__salir')!
      .click();
    http.expectOne('/api/auth/logout/').flush(null);
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('Salir');
    expect(texto(fixture)).toContain('Iniciar sesion');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/productos');
  });
});
