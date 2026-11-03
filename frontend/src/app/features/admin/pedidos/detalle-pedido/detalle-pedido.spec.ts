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
    etapa: 'recibido',
    etapa_nombre: 'Recibido',
    etapas_siguientes: ['en_preparacion', 'cancelado'],
    seguimiento: [
      { etapa: 'recibido', etapa_nombre: 'Recibido', fecha: '2026-10-08T12:00:00Z' },
    ],
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

  function opcionesEstado(fixture: ComponentFixture<DetallePedido>) {
    return elemento(fixture).querySelectorAll<HTMLInputElement>('.estado-opciones input[type="radio"]');
  }

  it('muestra las tres opciones de estado, con la actual marcada', async () => {
    const { fixture } = await conPedido({ estado: 'por_cobrar' });

    const opciones = opcionesEstado(fixture);
    expect(opciones.length).toBe(3);
    expect(texto(fixture)).toContain('El cliente va a pagar por transferencia');
    expect(texto(fixture)).toContain('Se cobra contraentrega');
    expect([...opciones].find((o) => o.checked)?.closest('label')?.textContent).toContain(
      'Por cobrar',
    );
  });

  it('al elegir un estado distinto, lo envia y actualiza la pantalla', async () => {
    const { fixture, http } = await conPedido();

    opcionesEstado(fixture)[2].dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const peticion = http.expectOne('/api/pedidos/admin/15/cambiar-estado/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ estado: 'pagado' });
    peticion.flush(pedido({ estado: 'pagado' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Pagado');
  });

  it('no envia nada si se elige el estado que ya tiene', async () => {
    const { fixture, http } = await conPedido({ estado: 'por_confirmar' });

    opcionesEstado(fixture)[0].dispatchEvent(new Event('change'));
    await fixture.whenStable();

    http.expectNone('/api/pedidos/admin/15/cambiar-estado/');
  });

  it('avisa cuando no se puede cambiar el estado', async () => {
    const { fixture, http } = await conPedido();

    opcionesEstado(fixture)[2].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    http
      .expectOne('/api/pedidos/admin/15/cambiar-estado/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cambiar el estado del pedido');
  });

  // --- etapa del pedido (FR-12) ---------------------------------------------

  function boton(fixture: ComponentFixture<DetallePedido>, textoBoton: string) {
    return [...elemento(fixture).querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(textoBoton),
    );
  }

  it('muestra el seguimiento con la etapa actual', async () => {
    const { fixture } = await conPedido();

    expect(texto(fixture)).toContain('Seguimiento del pedido');
    const actual = elemento(fixture).querySelector('[aria-current="step"]');
    expect(actual?.textContent).toContain('Recibido');
  });

  it('avanza el pedido al siguiente paso', async () => {
    const { fixture, http } = await conPedido();

    boton(fixture, 'Pasar a en preparacion')!.click();
    await fixture.whenStable();

    const peticion = http.expectOne('/api/pedidos/admin/15/cambiar-etapa/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ etapa: 'en_preparacion' });
    peticion.flush(
      pedido({
        etapa: 'en_preparacion',
        etapa_nombre: 'En preparacion',
        etapas_siguientes: ['en_camino', 'cancelado'],
        seguimiento: [
          { etapa: 'recibido', etapa_nombre: 'Recibido', fecha: '2026-10-08T12:00:00Z' },
          { etapa: 'en_preparacion', etapa_nombre: 'En preparacion', fecha: '2026-10-08T13:00:00Z' },
        ],
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(boton(fixture, 'Pasar a en camino')).toBeTruthy();
    expect(elemento(fixture).querySelector('[aria-current="step"]')?.textContent).toContain(
      'En preparacion',
    );
  });

  it('pide confirmar antes de cancelar', async () => {
    const { fixture, http } = await conPedido();

    boton(fixture, 'Cancelar pedido')!.click();
    fixture.detectChanges();

    http.expectNone('/api/pedidos/admin/15/cambiar-etapa/');
    expect(texto(fixture)).toContain('no se puede deshacer');

    boton(fixture, 'Si, cancelar')!.click();
    await fixture.whenStable();

    const peticion = http.expectOne('/api/pedidos/admin/15/cambiar-etapa/');
    expect(peticion.request.body).toEqual({ etapa: 'cancelado' });
  });

  it('no muestra acciones de etapa cuando el pedido ya fue entregado', async () => {
    const { fixture } = await conPedido({
      etapa: 'entregado',
      etapa_nombre: 'Entregado',
      etapas_siguientes: [],
    });

    expect(boton(fixture, 'Pasar a')).toBeUndefined();
    expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
    expect(texto(fixture)).toContain('ya no cambia de etapa');
  });

  it('muestra el motivo cuando el backend rechaza el cambio de etapa', async () => {
    const { fixture, http } = await conPedido();

    boton(fixture, 'Pasar a en preparacion')!.click();
    await fixture.whenStable();
    http
      .expectOne('/api/pedidos/admin/15/cambiar-etapa/')
      .flush(
        { detail: 'Un pedido recibido no puede pasar a entregado.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Un pedido recibido no puede pasar a entregado.');
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
