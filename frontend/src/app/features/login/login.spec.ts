import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(Login);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('redirige al catalogo cuando las credenciales son correctas', () => {
    const fixture = TestBed.createComponent(Login);
    const componente = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl');

    componente['formulario'].setValue({
      email: 'ana@example.com',
      password: 'UnaClaveSegura123',
    });
    componente['enviar']();

    http.expectOne('/api/auth/login/').flush({
      id: 1,
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@example.com',
      telefono: '',
    });

    expect(navegar).toHaveBeenCalledWith('/productos');
  });

  it('alterna el tipo del campo de contrasena al pulsar mostrar/ocultar', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    const campo = elemento.querySelector<HTMLInputElement>('#password')!;
    const boton = elemento.querySelector<HTMLButtonElement>('.campo-password button')!;

    expect(campo.type).toBe('password');

    boton.click();
    fixture.detectChanges();
    expect(campo.type).toBe('text');
    expect(boton.textContent).toContain('Ocultar');

    boton.click();
    fixture.detectChanges();
    expect(campo.type).toBe('password');
  });

  it('muestra un error generico cuando las credenciales son incorrectas', () => {
    const fixture = TestBed.createComponent(Login);
    const componente = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

    componente['formulario'].setValue({
      email: 'ana@example.com',
      password: 'contrasena-mala',
    });
    componente['enviar']();

    http.expectOne('/api/auth/login/').flush(
      { non_field_errors: ['Correo o contrasena incorrectos.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Correo o contrasena incorrectos.');
  });
});
