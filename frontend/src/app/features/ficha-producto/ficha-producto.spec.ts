import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { ComponentRef, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { FichaProducto } from './ficha-producto';

registerLocaleData(localeEsCo);

function producto(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Lomo fino',
    slug: 'lomo-fino',
    descripcion: 'Corte magro y suave.',
    presentacion: 'Bandeja 500 g',
    precio: '38900.00',
    foto_url: 'https://ejemplo.test/lomo-fino.jpg',
    disponible: true,
    categoria: 'Res',
    calificacion_promedio: null,
    total_resenas: 0,
    ...sobrescribir,
  };
}

function paginaResenas(sobrescribir: Record<string, unknown> = {}) {
  return { count: 0, next: null, previous: null, results: [], ...sobrescribir };
}

function resena(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 1,
    usuario_nombre: 'Ana Gomez',
    calificacion: 5,
    comentario: 'Excelente',
    es_propia: false,
    creado_en: '2026-01-01T00:00:00Z',
    ...sobrescribir,
  };
}

function usuarioMock(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 7,
    first_name: 'Carlos',
    last_name: 'Ruiz',
    email: 'carlos@example.com',
    telefono: '',
    ...sobrescribir,
  };
}

describe('FichaProducto', () => {
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FichaProducto],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    auth = TestBed.inject(AuthService);
  });

  function crear(slug = 'lomo-fino', opciones: { autenticado?: boolean } = {}) {
    if (opciones.autenticado) {
      auth.usuario.set(usuarioMock());
    }
    const fixture = TestBed.createComponent(FichaProducto);
    (fixture.componentRef as ComponentRef<FichaProducto>).setInput('slug', slug);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<FichaProducto>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: { nativeElement: unknown }) {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** Responde el producto, el listado de resenas y, si aplica, puede-resenar. */
  async function cargarTodo(
    fixture: ComponentFixture<FichaProducto>,
    http: HttpTestingController,
    opciones: {
      producto?: Record<string, unknown>;
      resenas?: Record<string, unknown>;
      puedeResenar?: Record<string, unknown>;
    } = {},
  ) {
    http.expectOne((r) => r.url === '/api/productos/lomo-fino/').flush(producto(opciones.producto));
    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'GET')
      .flush(paginaResenas(opciones.resenas));
    if (opciones.puedeResenar) {
      http
        .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/puede-resenar/')
        .flush(opciones.puedeResenar);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('pide el producto por su slug', () => {
    const { http } = crear('lomo-fino');

    http.expectOne('/api/productos/lomo-fino/');
  });

  it('muestra el detalle cuando la API responde', async () => {
    const { fixture, http } = crear();

    http.expectOne('/api/productos/lomo-fino/').flush(producto());
    await fixture.whenStable();
    fixture.detectChanges();

    const texto_ = texto(fixture);
    expect(texto_).toContain('Lomo fino');
    expect(texto_).toContain('Corte magro y suave.');
    expect(texto_).toContain('38.900');
    expect(texto_).toContain('Disponible');
  });

  it('avisa cuando el producto no existe', async () => {
    const { fixture, http } = crear('no-existe');

    http
      .expectOne('/api/productos/no-existe/')
      .flush('no encontrado', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No encontramos este producto');
  });

  it('avisa cuando el backend no responde', async () => {
    const { fixture, http } = crear();

    http
      .expectOne('/api/productos/lomo-fino/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar el producto');
  });

  // --- resenas (FR-18) -------------------------------------------------------

  it('pide las resenas del producto', () => {
    const { http } = crear();

    const peticion = http.expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/');
    expect(peticion.request.params.get('page')).toBe('1');
    expect(peticion.request.params.get('page_size')).toBe('10');
  });

  it('muestra el promedio y el total cuando el producto tiene resenas', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http, { producto: { calificacion_promedio: 4.5, total_resenas: 3 } });

    const texto_ = texto(fixture);
    expect(texto_).toContain('4.5');
    expect(texto_).toContain('3');
    expect(texto_).toContain('reseñas');
  });

  it('avisa que todavia no tiene resenas cuando el producto no tiene ninguna', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http);

    expect(texto(fixture)).toContain('Todavia no tiene reseñas');
  });

  it('lista las resenas con su autor y comentario', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http, {
      resenas: {
        count: 1,
        results: [resena({ usuario_nombre: 'Carlos Ruiz', comentario: 'Muy fresco y bien empacado' })],
      },
    });

    const texto_ = texto(fixture);
    expect(texto_).toContain('Carlos Ruiz');
    expect(texto_).toContain('Muy fresco y bien empacado');
  });

  it('avisa cuando no hay resenas en la lista', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http);

    expect(texto(fixture)).toContain('Todavia no hay reseñas para este producto');
  });

  it('pide la pagina siguiente de resenas al pulsar Siguiente', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http, {
      resenas: { count: 15, next: '/api/productos/lomo-fino/resenas/?page=2', results: [resena()] },
    });

    const botones = elemento(fixture).querySelectorAll<HTMLButtonElement>('.paginacion button');
    botones[1].click();
    await fixture.whenStable();

    const peticion = http.expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/');
    expect(peticion.request.params.get('page')).toBe('2');
  });

  it('invita a iniciar sesion si no hay usuario autenticado', async () => {
    const { fixture, http } = crear();
    await cargarTodo(fixture, http);

    expect(texto(fixture)).toContain('Inicia sesion');
    expect(elemento(fixture).querySelector('.form-resena--nueva')).toBeNull();
  });

  it('pide si puede resenar cuando hay sesion activa', () => {
    const { http } = crear('lomo-fino', { autenticado: true });

    http.expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/puede-resenar/');
  });

  it('avisa que debe comprar el producto si todavia no lo ha comprado', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      puedeResenar: { ha_comprado: false, ya_reseno: false, puede_resenar: false },
    });

    expect(texto(fixture)).toContain('Debes haber comprado este producto');
    expect(elemento(fixture).querySelector('.form-resena--nueva')).toBeNull();
  });

  it('muestra el formulario para dejar la resena cuando puede resenar', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      puedeResenar: { ha_comprado: true, ya_reseno: false, puede_resenar: true },
    });

    expect(elemento(fixture).querySelector('.form-resena--nueva')).toBeTruthy();
  });

  it('no muestra el formulario de creacion si ya reseño este producto', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      puedeResenar: { ha_comprado: true, ya_reseno: true, puede_resenar: false },
    });

    expect(elemento(fixture).querySelector('.form-resena--nueva')).toBeNull();
    expect(texto(fixture)).not.toContain('Debes haber comprado');
  });

  it('envia la nueva resena y recarga la lista', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      puedeResenar: { ha_comprado: true, ya_reseno: false, puede_resenar: true },
    });
    const componente = fixture.componentInstance;

    componente['formularioResena'].setValue({ calificacion: 4, comentario: 'Muy bueno' });
    componente['enviarResena']();

    const creacion = http.expectOne(
      (r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'POST',
    );
    expect(creacion.request.body).toEqual({ calificacion: 4, comentario: 'Muy bueno' });
    creacion.flush(resena({ id: 9, calificacion: 4, comentario: 'Muy bueno', es_propia: true }));
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'GET')
      .flush(
        paginaResenas({
          count: 1,
          results: [resena({ id: 9, calificacion: 4, comentario: 'Muy bueno', es_propia: true })],
        }),
      );
    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/puede-resenar/')
      .flush({ ha_comprado: true, ya_reseno: true, puede_resenar: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Muy bueno');
    expect(elemento(fixture).querySelector('.form-resena--nueva')).toBeNull();
  });

  it('muestra el error cuando el backend rechaza la resena', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      puedeResenar: { ha_comprado: true, ya_reseno: false, puede_resenar: true },
    });
    const componente = fixture.componentInstance;

    componente['formularioResena'].setValue({ calificacion: 3, comentario: '' });
    componente['enviarResena']();

    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'POST')
      .flush(
        { detail: 'Debes haber comprado este producto para poder reseñarlo.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Debes haber comprado este producto para poder reseñarlo.');
  });

  it('permite editar la propia resena', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      resenas: { count: 1, results: [resena({ id: 9, calificacion: 3, comentario: 'Regular', es_propia: true })] },
      puedeResenar: { ha_comprado: true, ya_reseno: true, puede_resenar: false },
    });

    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-editar')!.click();
    fixture.detectChanges();
    expect(elemento(fixture).querySelector('.form-resena--editar')).toBeTruthy();

    const componente = fixture.componentInstance;
    componente['formularioResena'].setValue({ calificacion: 5, comentario: 'Cambie de opinion' });
    componente['enviarResena']();

    const edicion = http.expectOne((r) => r.url === '/api/resenas/9/' && r.method === 'PATCH');
    expect(edicion.request.body).toEqual({ calificacion: 5, comentario: 'Cambie de opinion' });
    edicion.flush(resena({ id: 9, calificacion: 5, comentario: 'Cambie de opinion', es_propia: true }));
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'GET')
      .flush(
        paginaResenas({
          count: 1,
          results: [resena({ id: 9, calificacion: 5, comentario: 'Cambie de opinion', es_propia: true })],
        }),
      );
    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/puede-resenar/')
      .flush({ ha_comprado: true, ya_reseno: true, puede_resenar: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Cambie de opinion');
    expect(elemento(fixture).querySelector('.form-resena--editar')).toBeNull();
  });

  it('cancelar la edicion vuelve a mostrar la resena sin el formulario', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      resenas: { count: 1, results: [resena({ id: 9, es_propia: true })] },
      puedeResenar: { ha_comprado: true, ya_reseno: true, puede_resenar: false },
    });

    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-editar')!.click();
    fixture.detectChanges();
    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-cancelar-edicion')!.click();
    fixture.detectChanges();

    expect(elemento(fixture).querySelector('.form-resena--editar')).toBeNull();
    http.expectNone((r) => r.method === 'PATCH');
  });

  it('pide confirmacion antes de eliminar la propia resena', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      resenas: { count: 1, results: [resena({ id: 9, es_propia: true })] },
      puedeResenar: { ha_comprado: true, ya_reseno: true, puede_resenar: false },
    });

    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-eliminar')!.click();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Eliminar tu reseña');
    http.expectNone((r) => r.method === 'DELETE');
  });

  it('al confirmar, elimina la resena y recarga la lista', async () => {
    const { fixture, http } = crear('lomo-fino', { autenticado: true });
    await cargarTodo(fixture, http, {
      resenas: { count: 1, results: [resena({ id: 9, es_propia: true })] },
      puedeResenar: { ha_comprado: true, ya_reseno: true, puede_resenar: false },
    });

    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-eliminar')!.click();
    fixture.detectChanges();
    elemento(fixture).querySelector<HTMLButtonElement>('.resena__boton-eliminar-confirmar')!.click();
    await fixture.whenStable();

    const borrado = http.expectOne((r) => r.url === '/api/resenas/9/' && r.method === 'DELETE');
    borrado.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/' && r.method === 'GET')
      .flush(paginaResenas());
    http
      .expectOne((r) => r.url === '/api/productos/lomo-fino/resenas/puede-resenar/')
      .flush({ ha_comprado: true, ya_reseno: false, puede_resenar: true });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Todavia no hay reseñas');
  });
});
