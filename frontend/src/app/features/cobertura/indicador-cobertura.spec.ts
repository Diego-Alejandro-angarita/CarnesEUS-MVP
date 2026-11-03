import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ZonaEntregaService } from '../../core/services/zona-entrega.service';
import { IndicadorCobertura } from './indicador-cobertura';

function crear(barrio?: string) {
  const fixture = TestBed.createComponent(IndicadorCobertura);
  if (barrio !== undefined) {
    fixture.componentRef.setInput('barrio', barrio);
  }
  // El effect que precarga la comuna corre con la deteccion de cambios.
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, http, componente: fixture.componentInstance };
}

function consulta(http: HttpTestingController) {
  return http.expectOne((peticion) => peticion.url === '/api/cobertura/');
}

describe('IndicadorCobertura', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [IndicadorCobertura],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
  });

  it('se construye', () => {
    const { componente } = crear();
    expect(componente).toBeTruthy();
  });

  it('ofrece las comunas y los corregimientos de Medellin', () => {
    const { fixture } = crear();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    const grupos = Array.from(select.querySelectorAll('optgroup')).map((grupo) => grupo.label);
    const opciones = Array.from(select.options).map((opcion) => opcion.value);

    expect(grupos).toEqual(['Comunas', 'Corregimientos']);
    expect(opciones).toContain('Laureles-Estadio');
    expect(opciones).toContain('Altavista');
  });

  it('no consulta si falta la comuna', () => {
    const { componente, http } = crear();

    componente['verificar']();

    http.expectNone((peticion) => peticion.url === '/api/cobertura/');
    expect(componente['estado']()).toBe('inicial');
    expect(componente['comunaInvalida']).toBe(true);
  });

  it('marca la comuna como cubierta, la recuerda y avisa al padre', () => {
    const { componente, http } = crear();
    const avisos: boolean[] = [];
    componente.resultado.subscribe((valor) => avisos.push(valor));

    componente['formulario'].setValue({ comuna: 'Laureles-Estadio' });
    componente['verificar']();

    const peticion = consulta(http);
    expect(peticion.request.params.get('municipio')).toBe('Medellin');
    expect(peticion.request.params.get('barrio')).toBe('Laureles-Estadio');
    peticion.flush({
      cubierta: true,
      municipio: 'Medellin',
      barrio: 'Laureles-Estadio',
      mensaje: 'Hacemos domicilios a este barrio.',
    });

    expect(componente['estado']()).toBe('cubierta');
    expect(componente['mensaje']()).toBe('Hacemos domicilios a este barrio.');
    expect(avisos).toEqual([true]);

    const zona = TestBed.inject(ZonaEntregaService);
    expect(zona.comuna()).toBe('Laureles-Estadio');
    expect(zona.cubierta()).toBe(true);
  });

  it('marca la comuna como fuera de cobertura', () => {
    const { componente, http } = crear();
    const avisos: boolean[] = [];
    componente.resultado.subscribe((valor) => avisos.push(valor));

    componente['formulario'].setValue({ comuna: 'Altavista' });
    componente['verificar']();
    consulta(http).flush({
      cubierta: false,
      municipio: 'Medellin',
      barrio: 'Altavista',
      mensaje: 'Por ahora no hacemos domicilios a este barrio.',
    });

    expect(componente['estado']()).toBe('sin-cobertura');
    expect(avisos).toEqual([false]);
  });

  it('quita el resultado cuando el cliente cambia la comuna', () => {
    const { componente, http } = crear();

    componente['formulario'].setValue({ comuna: 'Laureles-Estadio' });
    componente['verificar']();
    consulta(http).flush({
      cubierta: true,
      municipio: 'Medellin',
      barrio: 'Laureles-Estadio',
      mensaje: 'ok',
    });
    expect(componente['estado']()).toBe('cubierta');

    componente['formulario'].controls.comuna.setValue('Robledo');

    expect(componente['estado']()).toBe('inicial');
  });

  it('avisa cuando la API falla', () => {
    const { componente, http } = crear();

    componente['formulario'].setValue({ comuna: 'Laureles-Estadio' });
    componente['verificar']();
    consulta(http).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(componente['estado']()).toBe('error');
  });

  it('precarga la comuna que recibe del padre', () => {
    const { componente } = crear('Belen');

    expect(componente['formulario'].controls.comuna.value).toBe('Belen');
  });

  it('precarga la comuna que el cliente ya habia elegido', () => {
    TestBed.inject(ZonaEntregaService).recordar('El Poblado', true);

    const { componente } = crear();

    expect(componente['formulario'].controls.comuna.value).toBe('El Poblado');
  });
});
