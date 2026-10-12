import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { ComponentRef, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DetallePedido } from './detalle-pedido';

registerLocaleData(localeEsCo);

function pedido(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 15,
    estado: 'por_confirmar',
    total: '77800.00',
    nombre: 'Ana Gomez',
    email: 'ana@example.com',
    telefono: '3001234567',
    direccion: 'Cra 70 # 45-10',
    municipio: 'Medellin',
    barrio: 'Laureles',
    notas: '',
    items: [
      {
        producto_id: 1,
        producto_slug: 'lomo-fino',
        nombre: 'Lomo fino',
        precio_unitario: '38900.00',
        cantidad: 2,
        subtotal: '77800.00',
      },
    ],
    pago: {
      metodo: 'transferencia',
      metodo_nombre: 'Transferencia',
      estado: 'pendiente',
      monto: '77800.00',
      referencia: '',
    },
    instrucciones_pago: null,
    creado_en: '2026-10-08T12:00:00Z',
    ...sobrescribir,
  };
}

describe('DetallePedido', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallePedido],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function crear(id = 15) {
    const fixture = TestBed.createComponent(DetallePedido);
    (fixture.componentRef as ComponentRef<DetallePedido>).setInput('id', id);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<DetallePedido>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<DetallePedido>) {
    return elemento(fixture).textContent ?? '';
  }

  async function conPedido(datos: Record<string, unknown> = {}) {
    const { fixture, http } = crear();
    http.expectOne('/api/pedidos/admin/15/').flush(pedido(datos));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide el pedido por su id', () => {
    crear(15);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pedidos/admin/15/');
  });

  it('muestra los datos de entrega, pago y los productos', async () => {
    const { fixture } = await conPedido();

    const texto_ = texto(fixture);
    expect(texto_).toContain('Ana Gomez');
    expect(texto_).toContain('ana@example.com');
    expect(texto_).toContain('Cra 70 # 45-10, Laureles, Medellin');
    expect(texto_).toContain('Transferencia');
    expect(texto_).toContain('2 x Lomo fino');
    expect(texto_).toContain('77.800');
    expect(texto_).toContain('Por confirmar');
  });

  it('ofrece marcar como pagado si todavia no lo esta', async () => {
    const { fixture } = await conPedido();

    const boton = elemento(fixture).querySelector('button');
    expect(boton?.textContent).toContain('Marcar como pagado');
  });

  it('no ofrece marcar como pagado un pedido que ya lo esta', async () => {
    const { fixture } = await conPedido({ estado: 'pagado' });

    expect(elemento(fixture).querySelector('button')).toBeNull();
  });

  it('al marcar como pagado, actualiza el estado mostrado', async () => {
    const { fixture, http } = await conPedido();

    elemento(fixture).querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    const peticion = http.expectOne('/api/pedidos/admin/15/marcar-pagado/');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(pedido({ estado: 'pagado' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Pagado');
    expect(elemento(fixture).querySelector('button')).toBeNull();
  });

  it('avisa cuando no se puede marcar como pagado', async () => {
    const { fixture, http } = await conPedido();

    elemento(fixture).querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    http
      .expectOne('/api/pedidos/admin/15/marcar-pagado/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos marcar el pedido como pagado');
  });

  it('avisa cuando el pedido no existe', async () => {
    const { fixture, http } = crear(999);

    http.expectOne('/api/pedidos/admin/999/').flush('no encontrado', {
      status: 404,
      statusText: 'Not Found',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Este pedido no existe');
  });
});
