import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Registro } from './registro';

describe('Registro', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(Registro);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra un mensaje de exito cuando la API crea la cuenta', () => {
    const fixture = TestBed.createComponent(Registro);
    const componente = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

    componente['formulario'].setValue({
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@example.com',
      telefono: '',
      password: 'UnaClaveSegura123',
      password_confirmacion: 'UnaClaveSegura123',
    });
    componente['enviar']();

    http.expectOne('/api/auth/registro/').flush({
      id: 1,
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@example.com',
      telefono: '',
    });
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Cuenta creada correctamente');
  });

  it('muestra el error que devuelve la API cuando falla', () => {
    const fixture = TestBed.createComponent(Registro);
    const componente = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

    componente['formulario'].setValue({
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@example.com',
      telefono: '',
      password: 'UnaClaveSegura123',
      password_confirmacion: 'UnaClaveSegura123',
    });
    componente['enviar']();

    http.expectOne('/api/auth/registro/').flush(
      { email: ['Ya existe una cuenta con este correo.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Ya existe una cuenta con este correo.');
  });
});
