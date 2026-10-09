import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IndicadorCobertura } from './indicador-cobertura';

const ZONAS = [
  { municipio: 'Medellin', barrio: 'Laureles' },
  { municipio: 'Medellin', barrio: 'Belen' },
  { municipio: 'Envigado', barrio: 'Centro' },
];

function crear() {
  const fixture = TestBed.createComponent(IndicadorCobertura);
  const http = TestBed.inject(HttpTestingController);
  // Al construirse pide las zonas para las sugerencias.
  http.expectOne('/api/cobertura/zonas/').flush(ZONAS);
  return { fixture, http, componente: fixture.componentInstance };
}

function consulta(http: HttpTestingController) {
  return http.expectOne((peticion) => peticion.url === '/api/cobertura/');
}

describe('IndicadorCobertura', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndicadorCobertura],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('se construye', () => {
    const { componente } = crear();
    expect(componente).toBeTruthy();
  });

  it('sugiere los municipios y solo los barrios del municipio escrito', () => {
    const { componente } = crear();

    expect(componente['municipiosSugeridos']()).toEqual(['Envigado', 'Medellin']);

    componente['formulario'].controls.municipio.setValue('medellín');
    expect(componente['barriosSugeridos']()).toEqual(['Belen', 'Laureles']);
  });

  it('no consulta si falta el municipio o el barrio', () => {
    const { componente, http } = crear();

    componente['formulario'].setValue({ municipio: 'Medellin', barrio: '' });
    componente['verificar']();

    http.expectNone((peticion) => peticion.url === '/api/cobertura/');
    expect(componente['estado']()).toBe('inicial');
  });

  it('marca la zona como cubierta y avisa al padre', () => {
    const { componente, http } = crear();
    const avisos: boolean[] = [];
    componente.resultado.subscribe((valor) => avisos.push(valor));

    componente['formulario'].setValue({ municipio: 'Medellin', barrio: 'Laureles' });
    componente['verificar']();

    const peticion = consulta(http);
    expect(peticion.request.params.get('municipio')).toBe('Medellin');
    expect(peticion.request.params.get('barrio')).toBe('Laureles');
    peticion.flush({
      cubierta: true,
      municipio: 'Medellin',
      barrio: 'Laureles',
      mensaje: 'Hacemos domicilios a este barrio.',
    });

    expect(componente['estado']()).toBe('cubierta');
    expect(componente['mensaje']()).toBe('Hacemos domicilios a este barrio.');
    expect(avisos).toEqual([true]);
  });

  it('marca la zona como fuera de cobertura', () => {
    const { componente, http } = crear();
    const avisos: boolean[] = [];
    componente.resultado.subscribe((valor) => avisos.push(valor));

    componente['formulario'].setValue({ municipio: 'Medellin', barrio: 'Robledo' });
    componente['verificar']();
    consulta(http).flush({
      cubierta: false,
      municipio: 'Medellin',
      barrio: 'Robledo',
      mensaje: 'Por ahora no hacemos domicilios a este barrio.',
    });

    expect(componente['estado']()).toBe('sin-cobertura');
    expect(avisos).toEqual([false]);
  });

  it('quita el resultado cuando el cliente cambia el barrio', () => {
    const { componente, http } = crear();

    componente['formulario'].setValue({ municipio: 'Medellin', barrio: 'Laureles' });
    componente['verificar']();
    consulta(http).flush({
      cubierta: true,
      municipio: 'Medellin',
      barrio: 'Laureles',
      mensaje: 'ok',
    });
    expect(componente['estado']()).toBe('cubierta');

    componente['formulario'].controls.barrio.setValue('Robledo');

    expect(componente['estado']()).toBe('inicial');
  });

  it('avisa cuando la API falla', () => {
    const { componente, http } = crear();

    componente['formulario'].setValue({ municipio: 'Medellin', barrio: 'Laureles' });
    componente['verificar']();
    consulta(http).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(componente['estado']()).toBe('error');
  });

  it('el formulario sigue sirviendo si las sugerencias fallan', () => {
    const fixture = TestBed.createComponent(IndicadorCobertura);
    const http = TestBed.inject(HttpTestingController);

    http
      .expectOne('/api/cobertura/zonas/')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance['zonas']()).toEqual([]);
  });
});
