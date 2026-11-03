import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EditarPromocion } from './editar-promocion';

registerLocaleData(localeEsCo);

const PRODUCTOS = [
  { id: 1, nombre: 'Lomo fino', categoria: 'Res', precio: '38900.00' },
  { id: 2, nombre: 'Churrasco', categoria: 'Res', precio: '29900.00' },
];

function promocion(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Semana de la res',
    porcentaje: 20,
    fecha_inicio: '2026-10-08',
    fecha_fin: '2026-10-15',
    activa: true,
    productos: [1],
    productos_detalle: [{ id: 1, nombre: 'Lomo fino' }],
    estado: 'vigente',
    ...sobrescribir,
  };
}

describe('EditarPromocion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarPromocion],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear(id = 5) {
    const fixture = TestBed.createComponent(EditarPromocion);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  async function cargada(datos = promocion()) {
    const { fixture, http } = crear();
    http.expectOne('/api/promociones/productos/').flush(PRODUCTOS);
    http.expectOne('/api/promociones/5/').flush(datos);
    // Dos esperas: la carga combina ambas peticiones con Promise.all.
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function elemento(fixture: ComponentFixture<EditarPromocion>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<EditarPromocion>) {
    return elemento(fixture).textContent ?? '';
  }

  function campo(fixture: ComponentFixture<EditarPromocion>, id: string) {
    return elemento(fixture).querySelector<HTMLInputElement>(`#${id}`)!;
  }

  async function enviar(fixture: ComponentFixture<EditarPromocion>) {
    elemento(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('rellena el formulario con la promocion guardada', async () => {
    const { fixture } = await cargada();

    expect(campo(fixture, 'nombre').value).toBe('Semana de la res');
    expect(campo(fixture, 'porcentaje').value).toBe('20');
    expect(campo(fixture, 'fecha_inicio').value).toBe('2026-10-08');
    expect(campo(fixture, 'fecha_fin').value).toBe('2026-10-15');

    const casillas = [
      ...elemento(fixture).querySelectorAll<HTMLInputElement>('.selector__lista input'),
    ];
    expect(casillas.map((casilla) => casilla.checked)).toEqual([true, false]);
  });

  it('guarda los cambios con un PATCH', async () => {
    const { fixture, http } = await cargada();

    const porcentaje = campo(fixture, 'porcentaje');
    porcentaje.value = '35';
    porcentaje.dispatchEvent(new Event('input'));
    await enviar(fixture);

    const peticion = http.expectOne('/api/promociones/5/');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toMatchObject({ porcentaje: 35, productos: [1] });

    peticion.flush(promocion({ porcentaje: 35 }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Cambios guardados');
    expect(texto(fixture)).toContain('35 %');
  });

  it('no reenvia productos que ya salieron del catalogo', async () => {
    // El 9 se elimino del catalogo despues de crear la promocion.
    const { fixture, http } = await cargada(promocion({ productos: [1, 9] }));

    await enviar(fixture);

    expect(http.expectOne('/api/promociones/5/').request.body.productos).toEqual([1]);
  });

  it('avisa cuando la promocion no existe', async () => {
    const { fixture, http } = crear();

    http.expectOne('/api/promociones/productos/').flush(PRODUCTOS);
    http
      .expectOne('/api/promociones/5/')
      .flush({ detail: 'No encontrado' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Esta promocion ya no existe');
  });

  it('avisa que hace falta una cuenta de administrador', async () => {
    const { fixture, http } = crear();

    http
      .expectOne('/api/promociones/productos/')
      .flush({ detail: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    http
      .expectOne('/api/promociones/5/')
      .flush({ detail: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('cuenta de administrador');
  });
});
