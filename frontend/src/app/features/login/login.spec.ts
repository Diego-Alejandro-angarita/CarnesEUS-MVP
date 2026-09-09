import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(Login);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra un mensaje de exito cuando las credenciales son correctas', () => {
    const fixture = TestBed.createComponent(Login);
    const componente = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

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
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Sesion iniciada correctamente');
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
