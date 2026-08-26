import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra la marca de la carniceria', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.marca__texto')?.textContent).toContain('CarnesEUS');
  });

  it('sin sesion ofrece iniciar sesion y no muestra el panel', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Iniciar sesion');
    expect(texto).not.toContain('Panel');
    expect(texto).not.toContain('Mis pedidos');
  });

  it('el panel solo aparece para el personal de la carniceria', async () => {
    const auth = TestBed.inject(AuthService);
    // Se simula la respuesta de /api/auth/me/ sin pasar por la red.
    (auth as unknown as { _usuario: { set: (v: unknown) => void } })._usuario.set({
      id: 1,
      email: 'staff@carneseus.co',
      nombre_completo: 'Personal',
      telefono: '',
      rol: 'STAFF',
      es_staff: true,
    });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Panel');
    expect(texto).toContain('Mis pedidos');
  });
});
