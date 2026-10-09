import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Checkout } from './checkout';

const CARRITO = {
  token: 'token-de-prueba',
  items: [
    {
      id: 7,
      producto_id: 1,
      nombre: 'Lomo fino',
      slug: 'lomo-fino',
      presentacion: 'Bandeja 500 g',
      foto_url: '',
      precio: '38900.00',
      cantidad: 2,
      comprable: true,
      subtotal: '77800.00',
    },
  ],
  cantidad_items: 2,
  total: '77800.00',
};

const CARRITO_VACIO = { ...CARRITO, items: [], cantidad_items: 0, total: '0.00' };

const CUENTA = {
  banco: 'Bancolombia',
  tipo_cuenta: 'Ahorros',
  numero_cuenta: '000-000000-00',
  titular: 'CarnesEUS',
};

function pedido(metodo: string, estado: string, cuenta: typeof CUENTA | null) {
  return {
    id: 15,
    estado,
    total: '77800.00',
    nombre: 'Ana Gomez',
    email: 'ana@example.com',
    telefono: '3001234567',
    direccion: 'Cra 70 # 45-10',
    municipio: 'Medellin',
    barrio: 'Laureles',
    notas: '',
    items: [
      { nombre: 'Lomo fino', precio_unitario: '38900.00', cantidad: 2, subtotal: '77800.00' },
    ],
    pago: {
      metodo,
      metodo_nombre: metodo,
      estado: 'pendiente',
      monto: '77800.00',
      referencia: '',
    },
    instrucciones_pago: cuenta,
    creado_en: '2026-10-08T12:00:00Z',
  };
}

const ENTREGA = {
  nombre: 'Ana Gomez',
  email: 'ana@example.com',
  telefono: '3001234567',
  direccion: 'Cra 70 # 45-10',
  municipio: 'Medellin',
  barrio: 'Laureles',
};

async function crear() {
  const fixture = TestBed.createComponent(Checkout);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/carrito/').flush(CARRITO);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, http, componente: fixture.componentInstance };
}

describe('Checkout', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('muestra el resumen del carrito', async () => {
    const { componente } = await crear();

    expect(componente['items']().length).toBe(1);
    expect(componente['total']()).toBe(77800);
  });

  it('ofrece los tres metodos de pago y transferencia viene elegida', async () => {
    const { componente } = await crear();

    expect(componente['metodos'].map((metodo) => metodo.valor)).toEqual([
      'transferencia',
      'contraentrega_qr',
      'contraentrega_datafono',
    ]);
    expect(componente['formulario'].controls.metodo_pago.value).toBe('transferencia');
  });

  it('no envia nada si el formulario esta incompleto', async () => {
    const { componente, http } = await crear();

    componente['enviar']();

    http.expectNone('/api/pedidos/');
  });

  it('compra por transferencia con el token del carrito y muestra la cuenta', async () => {
    const { componente, http } = await crear();
    componente['formulario'].patchValue({ ...ENTREGA, metodo_pago: 'transferencia' });

    componente['enviar']();

    const peticion = http.expectOne('/api/pedidos/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('X-Carrito-Token')).toBe('token-de-prueba');
    expect(peticion.request.body.metodo_pago).toBe('transferencia');
    peticion.flush(pedido('transferencia', 'por_confirmar', CUENTA));
    http.expectOne('/api/carrito/').flush(CARRITO_VACIO);

    expect(componente['pedido']()?.id).toBe(15);
    expect(componente['pedido']()?.total).toBe(77800);
    expect(componente['pedido']()?.instrucciones_pago?.banco).toBe('Bancolombia');
  });

  it.each(['contraentrega_qr', 'contraentrega_datafono'])(
    'compra con %s y no trae datos de cuenta',
    async (metodo) => {
      const { componente, http } = await crear();
      componente['formulario'].patchValue({ ...ENTREGA, metodo_pago: metodo as never });

      componente['enviar']();

      const peticion = http.expectOne('/api/pedidos/');
      expect(peticion.request.body.metodo_pago).toBe(metodo);
      peticion.flush(pedido(metodo, 'por_cobrar', null));
      http.expectOne('/api/carrito/').flush(CARRITO_VACIO);

      expect(componente['pedido']()?.estado).toBe('por_cobrar');
      expect(componente['pedido']()?.instrucciones_pago).toBeNull();
    },
  );

  it('muestra el mensaje de error que devuelve el backend y conserva el formulario', async () => {
    const { componente, http } = await crear();
    componente['formulario'].patchValue({ ...ENTREGA, metodo_pago: 'transferencia' });

    componente['enviar']();
    http
      .expectOne('/api/pedidos/')
      .flush(
        { detail: 'Tu carrito no tiene productos para comprar.' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(componente['error']()).toBe('Tu carrito no tiene productos para comprar.');
    expect(componente['pedido']()).toBeNull();
    expect(componente['enviando']()).toBe(false);
    expect(componente['formulario'].controls.nombre.value).toBe('Ana Gomez');
  });

  it('muestra el error de un campo cuando el backend lo rechaza', async () => {
    const { componente, http } = await crear();
    componente['formulario'].patchValue({ ...ENTREGA, metodo_pago: 'transferencia' });

    componente['enviar']();
    http
      .expectOne('/api/pedidos/')
      .flush(
        { email: ['Introduzca una dirección de correo electrónico válida.'] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(componente['error']()).toBe('Introduzca una dirección de correo electrónico válida.');
  });
});