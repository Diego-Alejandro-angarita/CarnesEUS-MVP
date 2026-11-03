import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { MisPedidos } from './mis-pedidos';

registerLocaleData(localeEsCo);

function fila(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 15,
    creado_en: '2026-10-08T12:00:00Z',
    total: '77800.00',
    etapa: 'en_camino',
    etapa_nombre: 'En camino',
    metodo_pago: 'Transferencia',
    ...sobrescribir,
  };
}

function pagina(resultados: unknown[], extra: Record<string, unknown> = {}) {
  return { count: resultados.length, next: null, previous: null, results: resultados, ...extra };
}

function pedido(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 15,
    estado: 'por_cobrar',
    etapa: 'en_preparacion',
    etapa_nombre: 'En preparacion',
    etapas_siguientes: ['en_camino', 'cancelado'],
    seguimiento: [
      { etapa: 'recibido', etapa_nombre: 'Recibido', fecha: '2026-10-08T12:00:00Z' },
      { etapa: 'en_preparacion', etapa_nombre: 'En preparacion', fecha: '2026-10-08T13:00:00Z' },
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
      metodo: 'contraentrega_qr',
      metodo_nombre: 'Contraentrega con QR',
      estado: 'pendiente',
      monto: '77800.00',
      referencia: '',
    },
    instrucciones_pago: null,
    creado_en: '2026-10-08T12:00:00Z',
    ...sobrescribir,
  };
}

const USUARIO = {
  id: 7,
  first_name: 'Ana',
  last_name: 'Gomez',
  email: 'ana@example.com',
  telefono: '',
  is_staff: false,
};

describe('MisPedidos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPedidos],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  function crear(opciones: { autenticado?: boolean; numero?: string } = {}) {
    const auth = TestBed.inject(AuthService);
    auth.verificando.set(false);
    auth.usuario.set(opciones.autenticado ? USUARIO : null);

    const fixture = TestBed.createComponent(MisPedidos);
    if (opciones.numero) {
      fixture.componentRef.setInput('numero', opciones.numero);
    }
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<MisPedidos>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<MisPedidos>) {
    return elemento(fixture).textContent ?? '';
  }

  async function estabilizar(fixture: ComponentFixture<MisPedidos>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function escribir(fixture: ComponentFixture<MisPedidos>, selector: string, valor: string) {
    const campo = elemento(fixture).querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function enviarConsulta(fixture: ComponentFixture<MisPedidos>) {
    elemento(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  // --- con sesion -------------------------------------------------------------

  it('con sesion pide los pedidos del cliente', () => {
    const { http } = crear({ autenticado: true });

    const peticion = http.expectOne((r) => r.url === '/api/pedidos/mios/');
    expect(peticion.request.params.get('page')).toBe('1');
    peticion.flush(pagina([]));
  });

  it('lista los pedidos con su etapa, total y enlace al detalle', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http.expectOne((r) => r.url === '/api/pedidos/mios/').flush(pagina([fila({ id: 42 })]));
    await estabilizar(fixture);

    expect(elemento(fixture).querySelectorAll('tbody tr').length).toBe(1);
    expect(texto(fixture)).toContain('#42');
    expect(texto(fixture)).toContain('En camino');
    expect(texto(fixture)).toContain('77.800');
    const enlace = elemento(fixture).querySelector('.tabla__acciones a');
    expect(enlace?.getAttribute('href')).toBe('/mis-pedidos/42');
  });

  it('avisa cuando el cliente todavia no tiene pedidos', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http.expectOne((r) => r.url === '/api/pedidos/mios/').flush(pagina([]));
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('Todavia no tienes pedidos');
  });

  it('avisa cuando no se pueden cargar los pedidos', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http
      .expectOne((r) => r.url === '/api/pedidos/mios/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('No pudimos cargar tus pedidos');
  });

  it('con sesion adelanta el correo de la cuenta en la consulta', async () => {
    const { fixture, http } = crear({ autenticado: true });
    http.expectOne((r) => r.url === '/api/pedidos/mios/').flush(pagina([]));
    await estabilizar(fixture);

    const correo = elemento(fixture).querySelector<HTMLInputElement>('#consulta-email')!;
    expect(correo.value).toBe('ana@example.com');
  });

  // --- sin sesion -------------------------------------------------------------

  it('sin sesion no pide la lista y muestra la consulta', () => {
    const { fixture, http } = crear();

    http.expectNone((r) => r.url === '/api/pedidos/mios/');
    expect(texto(fixture)).toContain('Consulta tu pedido');
    expect(elemento(fixture).querySelector('table')).toBeNull();
  });

  it('deja el numero ya escrito cuando llega en la URL', async () => {
    const { fixture } = crear({ numero: '15' });
    await estabilizar(fixture);

    const numero = elemento(fixture).querySelector<HTMLInputElement>('#consulta-numero')!;
    expect(numero.value).toBe('15');
  });

  it('no consulta si faltan datos', async () => {
    const { fixture, http } = crear();

    enviarConsulta(fixture);
    await estabilizar(fixture);

    http.expectNone('/api/pedidos/consultar/');
    expect(texto(fixture)).toContain('Escribe el numero de tu pedido');
  });

  it('consulta con numero y correo y muestra el seguimiento', async () => {
    const { fixture, http } = crear();
    escribir(fixture, '#consulta-numero', '15');
    escribir(fixture, '#consulta-email', ' ana@example.com ');

    enviarConsulta(fixture);

    const peticion = http.expectOne('/api/pedidos/consultar/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ numero: 15, email: 'ana@example.com' });
    peticion.flush(pedido());
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('Pedido #15: En preparacion');
    expect(elemento(fixture).querySelector('[aria-current="step"]')?.textContent).toContain(
      'En preparacion',
    );
    expect(texto(fixture)).toContain('2 x Lomo fino');
  });

  it('avisa cuando el numero y el correo no coinciden', async () => {
    const { fixture, http } = crear();
    escribir(fixture, '#consulta-numero', '15');
    escribir(fixture, '#consulta-email', 'otro@example.com');

    enviarConsulta(fixture);
    http
      .expectOne('/api/pedidos/consultar/')
      .flush({ detail: 'No encontrado' }, { status: 404, statusText: 'Not Found' });
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('No encontramos un pedido con ese numero y ese correo');
  });
});
