import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { DetalleMiPedido } from './detalle-mi-pedido';

registerLocaleData(localeEsCo);

function pedido() {
  return {
    id: 15,
    estado: 'pagado',
    etapa: 'entregado',
    etapa_nombre: 'Entregado',
    etapas_siguientes: [],
    seguimiento: [
      { etapa: 'recibido', etapa_nombre: 'Recibido', fecha: '2026-10-08T12:00:00Z' },
      { etapa: 'en_preparacion', etapa_nombre: 'En preparacion', fecha: '2026-10-08T13:00:00Z' },
      { etapa: 'en_camino', etapa_nombre: 'En camino', fecha: '2026-10-08T14:00:00Z' },
      { etapa: 'entregado', etapa_nombre: 'Entregado', fecha: '2026-10-08T15:00:00Z' },
    ],
    total: '77800.00',
    nombre: 'Ana Gomez',
    email: 'ana@example.com',
    telefono: '3001234567',
    direccion: 'Cra 70 # 45-10',
    municipio: 'Medellin',
    barrio: 'Laureles',
    notas: 'Porteria',
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
      estado: 'aprobado',
      monto: '77800.00',
      referencia: '',
    },
    instrucciones_pago: null,
    creado_en: '2026-10-08T12:00:00Z',
  };
}

describe('DetalleMiPedido', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleMiPedido],
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

  function crear(opciones: { autenticado?: boolean; verificando?: boolean } = {}) {
    const auth = TestBed.inject(AuthService);
    auth.verificando.set(opciones.verificando ?? false);
    auth.usuario.set(
      opciones.autenticado
        ? {
            id: 7,
            first_name: 'Ana',
            last_name: 'Gomez',
            email: 'ana@example.com',
            telefono: '',
            is_staff: false,
          }
        : null,
    );

    const fixture = TestBed.createComponent(DetalleMiPedido);
    fixture.componentRef.setInput('id', 15);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), auth };
  }

  function texto(fixture: ComponentFixture<DetalleMiPedido>) {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function estabilizar(fixture: ComponentFixture<DetalleMiPedido>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el seguimiento, la entrega, el pago y los productos', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http.expectOne('/api/pedidos/mios/15/').flush(pedido());
    await estabilizar(fixture);

    const contenido = texto(fixture);
    expect(contenido).toContain('Pedido #15: Entregado');
    expect(contenido).toContain('Cra 70 # 45-10, Laureles, Medellin');
    expect(contenido).toContain('Porteria');
    expect(contenido).toContain('Transferencia');
    expect(contenido).toContain('Pagado');
    expect(contenido).toContain('2 x Lomo fino');
    expect(contenido).toContain('77.800');
  });

  it('espera a que se verifique la sesion antes de pedir el pedido', async () => {
    const { fixture, http, auth } = crear({ autenticado: true, verificando: true });

    http.expectNone('/api/pedidos/mios/15/');

    auth.verificando.set(false);
    fixture.detectChanges();
    http.expectOne('/api/pedidos/mios/15/').flush(pedido());
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('Pedido #15: Entregado');
  });

  it('sin sesion ofrece iniciarla o consultar con numero y correo', () => {
    const { fixture, http } = crear();

    http.expectNone('/api/pedidos/mios/15/');
    expect(texto(fixture)).toContain('Inicia sesion');
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('a[href^="/mis-pedidos?"]');
    expect(enlace?.getAttribute('href')).toBe('/mis-pedidos?numero=15');
  });

  it('avisa cuando el pedido no es del cliente', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http
      .expectOne('/api/pedidos/mios/15/')
      .flush('no encontrado', { status: 404, statusText: 'Not Found' });
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('No encontramos este pedido entre los tuyos');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear({ autenticado: true });

    http
      .expectOne('/api/pedidos/mios/15/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await estabilizar(fixture);

    expect(texto(fixture)).toContain('No pudimos cargar el pedido');
  });
});
