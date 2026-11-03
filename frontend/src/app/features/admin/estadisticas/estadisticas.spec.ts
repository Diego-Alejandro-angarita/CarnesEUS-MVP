import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Estadisticas } from './estadisticas';

registerLocaleData(localeEsCo);

const RESUMEN = {
  desde: '2026-09-12',
  hasta: '2026-10-12',
  total_vendido: '150000',
  numero_pedidos: 3,
  ticket_promedio: '50000',
  clientes_unicos: 2,
  ventas_por_dia: [{ dia: '2026-10-10', total: '150000', pedidos: 3 }],
};

const PRODUCTOS = {
  mas_vendidos: [{ producto_id: 1, nombre: 'Lomo', unidades: 3, ingresos: '150000' }],
  por_categoria: [{ categoria: 'Res', unidades: 3, ingresos: '150000' }],
  por_barrio: [{ municipio: 'Medellin', barrio: 'Laureles', pedidos: 3, total: '150000' }],
  por_metodo_pago: [{ metodo: 'transferencia', pedidos: 3, total: '150000' }],
};

const CLIENTES = { segmentos: { nuevo: 2, recurrente: 1, inactivo: 0 } };

describe('Estadisticas', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Estadisticas],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(Estadisticas);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<Estadisticas>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<Estadisticas>) {
    return elemento(fixture).textContent ?? '';
  }

  async function conDatos() {
    const { fixture, http } = crear();
    http.expectOne((r) => r.url === '/api/estadisticas/resumen/').flush(RESUMEN);
    http.expectOne((r) => r.url === '/api/estadisticas/productos/').flush(PRODUCTOS);
    http.expectOne((r) => r.url === '/api/estadisticas/clientes/').flush(CLIENTES);
    // Promise.all + senales se propagan en varios microtasks: hace falta
    // mas de un ciclo para que la UI pase de 'cargando' a 'ok'.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('muestra el total vendido cuando el API responde', async () => {
    const { fixture } = await conDatos();

    expect(texto(fixture)).toContain('150.000');
    expect(texto(fixture)).toContain('Ticket promedio');
  });

  it('avisa cuando el backend falla', async () => {
    const { fixture, http } = crear();

    http.expectOne((r) => r.url === '/api/estadisticas/resumen/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    http.expectOne((r) => r.url === '/api/estadisticas/productos/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    http.expectOne((r) => r.url === '/api/estadisticas/clientes/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });

    // Promise.all rechaza en un microtask, el catch en otro, la senal en otro:
    // hace falta mas de un ciclo para que la UI pase a estado 'error'.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar las estadisticas');
  });
});
