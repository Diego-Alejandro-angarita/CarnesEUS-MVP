import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
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

const ITEM_PEDIDO_DEFAULT = {
  producto_id: 1,
  producto_slug: 'lomo-fino',
  nombre: 'Lomo fino',
  precio_unitario: '38900.00',
  cantidad: 2,
  subtotal: '77800.00',
};

function pedido(
  metodo: string,
  estado: string,
  cuenta: typeof CUENTA | null,
  items: unknown[] = [ITEM_PEDIDO_DEFAULT],
) {
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
    items,
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

function usuarioMock(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 7,
    first_name: 'Pepe',
    last_name: 'Agudin',
    email: 'pepe@example.com',
    telefono: '',
    ...sobrescribir,
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

async function crear(opciones: { autenticado?: boolean } = {}) {
  if (opciones.autenticado) {
    TestBed.inject(AuthService).usuario.set(usuarioMock());
  }
  const fixture = TestBed.createComponent(Checkout);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/carrito/').flush(CARRITO);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, http, componente: fixture.componentInstance };
}

/** Llena el formulario, lo envia y deja el componente en la pantalla de confirmacion. */
async function confirmarCompra(
  fixture: ComponentFixture<Checkout>,
  componente: Checkout,
  http: HttpTestingController,
  items?: unknown[],
) {
  componente['formulario'].patchValue({ ...ENTREGA, metodo_pago: 'transferencia' });
  componente['enviar']();
  http.expectOne('/api/pedidos/').flush(pedido('transferencia', 'por_confirmar', CUENTA, items));
  http.expectOne('/api/carrito/').flush(CARRITO_VACIO);
  await fixture.whenStable();
  fixture.detectChanges();
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

  // --- calificar lo recien comprado (FR-18) -----------------------------------

  it('no muestra la seccion de calificar si no hay sesion iniciada', async () => {
    const { fixture, componente, http } = await crear();
    await confirmarCompra(fixture, componente, http);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Califica tu compra');
  });

  it('muestra el formulario para calificar cuando solo se compro un producto', async () => {
    const { fixture, componente, http } = await crear({ autenticado: true });
    await confirmarCompra(fixture, componente, http);

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Califica tu compra');
    expect(elemento.querySelector('#producto-a-calificar')).toBeNull();
    expect(elemento.querySelector('.form-resena')).toBeTruthy();
  });

  it('con varios productos deja elegir cual calificar', async () => {
    const { fixture, componente, http } = await crear({ autenticado: true });
    await confirmarCompra(fixture, componente, http, [
      ITEM_PEDIDO_DEFAULT,
      {
        producto_id: 2,
        producto_slug: 'costilla',
        nombre: 'Costilla',
        precio_unitario: '20000.00',
        cantidad: 1,
        subtotal: '20000.00',
      },
    ]);

    const selector = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#producto-a-calificar',
    );
    expect(selector).toBeTruthy();
    expect(selector!.options.length).toBe(2);
    expect(componente['productoSeleccionado']()).toBe(1);
  });

  it('envia la calificacion del producto seleccionado', async () => {
    const { fixture, componente, http } = await crear({ autenticado: true });
    await confirmarCompra(fixture, componente, http);

    componente['formularioResena'].setValue({ calificacion: 4, comentario: 'Muy bueno' });
    componente['enviarResena']();

    const peticion = http.expectOne(
      (r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'POST',
    );
    expect(peticion.request.body).toEqual({ calificacion: 4, comentario: 'Muy bueno' });
    peticion.flush({
      id: 1,
      usuario_nombre: 'Pepe Agudin',
      calificacion: 4,
      comentario: 'Muy bueno',
      es_propia: true,
      creado_en: '2026-10-08T12:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gracias por calificar');
  });

  it('con varios productos, pasa al siguiente sin calificar despues de enviar', async () => {
    const { fixture, componente, http } = await crear({ autenticado: true });
    await confirmarCompra(fixture, componente, http, [
      ITEM_PEDIDO_DEFAULT,
      {
        producto_id: 2,
        producto_slug: 'costilla',
        nombre: 'Costilla',
        precio_unitario: '20000.00',
        cantidad: 1,
        subtotal: '20000.00',
      },
    ]);

    componente['formularioResena'].setValue({ calificacion: 5, comentario: '' });
    componente['enviarResena']();
    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'POST')
      .flush({
        id: 1,
        usuario_nombre: 'Pepe Agudin',
        calificacion: 5,
        comentario: '',
        es_propia: true,
        creado_en: '2026-10-08T12:00:00Z',
      });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(componente['productoSeleccionado']()).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('.form-resena')).toBeTruthy();
  });

  it('avisa cuando el backend rechaza la calificacion', async () => {
    const { fixture, componente, http } = await crear({ autenticado: true });
    await confirmarCompra(fixture, componente, http);

    componente['formularioResena'].setValue({ calificacion: 1, comentario: '' });
    componente['enviarResena']();

    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'POST')
      .flush(
        { detail: 'Ya reseñaste este producto. Edita tu reseña para cambiarla.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ya reseñaste este producto');
  });
});