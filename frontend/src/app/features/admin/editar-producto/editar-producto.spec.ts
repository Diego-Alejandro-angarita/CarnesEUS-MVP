import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EditarProducto } from './editar-producto';

const CATEGORIAS = [
  { id: 1, nombre: 'Res', slug: 'res' },
  { id: 2, nombre: 'Cerdo', slug: 'cerdo' },
];

function producto(sobrescribir: Record<string, unknown> = {}) {
  return {
    id: 7,
    categoria: 1,
    categoria_nombre: 'Res',
    nombre: 'Lomo fino',
    slug: 'lomo-fino',
    descripcion: 'Corte magro y suave.',
    presentacion: 'Bandeja 500 g',
    precio: '38900.00',
    foto_url: 'https://ejemplo.test/lomo-fino.jpg',
    disponible: true,
    ...sobrescribir,
  };
}

describe('EditarProducto', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarProducto],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function crear(id = 7) {
    const fixture = TestBed.createComponent(EditarProducto);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function elemento(fixture: ComponentFixture<EditarProducto>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<EditarProducto>) {
    return elemento(fixture).textContent ?? '';
  }

  function valor(fixture: ComponentFixture<EditarProducto>, id: string) {
    return elemento(fixture).querySelector<HTMLInputElement>(`#${id}`)?.value;
  }

  function escribir(fixture: ComponentFixture<EditarProducto>, id: string, texto: string) {
    const campo = elemento(fixture).querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  // La aplicacion corre sin zone.js. Se espera a whenStable() en vez de forzar
  // detectChanges(): asi la prueba falla si el componente no programa el
  // refresco por su cuenta.
  async function enviar(fixture: ComponentFixture<EditarProducto>) {
    elemento(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  /** Responde las dos peticiones de arranque y deja el formulario pintado. */
  async function conProducto(datos = producto()) {
    const { fixture, http } = crear();
    http.expectOne('/api/categorias/').flush(CATEGORIAS);
    http.expectOne('/api/productos/7/').flush(datos);
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('pide las categorias y el producto al arrancar', () => {
    const { http } = crear();

    expect(http.expectOne('/api/categorias/').request.method).toBe('GET');
    expect(http.expectOne('/api/productos/7/').request.method).toBe('GET');
  });

  it('rellena el formulario con los datos del producto', async () => {
    const { fixture } = await conProducto();

    expect(valor(fixture, 'nombre')).toBe('Lomo fino');
    expect(valor(fixture, 'presentacion')).toBe('Bandeja 500 g');
    expect(valor(fixture, 'precio')).toBe('38900');
    expect(elemento(fixture).querySelector<HTMLSelectElement>('#categoria')!.selectedIndex).toBe(1);
    expect(
      elemento(fixture).querySelector<HTMLInputElement>('.interruptor input')!.checked,
    ).toBe(true);
  });

  it('guarda los cambios con un PATCH al producto', async () => {
    const { fixture, http } = await conProducto();

    escribir(fixture, 'precio', '41500');
    await enviar(fixture);

    const peticion = http.expectOne('/api/productos/7/');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toMatchObject({ nombre: 'Lomo fino', precio: 41500 });
  });

  it('confirma que los cambios quedaron guardados', async () => {
    const { fixture, http } = await conProducto();

    escribir(fixture, 'precio', '41500');
    await enviar(fixture);
    http.expectOne('/api/productos/7/').flush(producto({ precio: '41500.00' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Cambios guardados');
    expect(texto(fixture)).toContain('Lomo fino');
  });

  it('permite volver al formulario despues de guardar', async () => {
    const { fixture, http } = await conProducto();

    await enviar(fixture);
    http.expectOne('/api/productos/7/').flush(producto());
    await fixture.whenStable();
    fixture.detectChanges();

    elemento(fixture).querySelector<HTMLButtonElement>('.exito button')!.click();
    await fixture.whenStable();

    expect(elemento(fixture).querySelector('form')).toBeTruthy();
    expect(valor(fixture, 'nombre')).toBe('Lomo fino');
  });

  it('no envia nada si se borra un campo obligatorio', async () => {
    const { fixture, http } = await conProducto();

    escribir(fixture, 'nombre', '');
    await enviar(fixture);

    http.expectNone('/api/productos/7/');
    expect(texto(fixture)).toContain('Este campo es obligatorio.');
  });

  it('muestra bajo cada campo los errores que devuelve el backend', async () => {
    const { fixture, http } = await conProducto();

    await enviar(fixture);
    http
      .expectOne('/api/productos/7/')
      .flush(
        { slug: ['Ya existe un producto con este slug.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Ya existe un producto con este slug.');
    expect(elemento(fixture).querySelector('form')).toBeTruthy();
  });

  it('avisa cuando el producto ya no existe', async () => {
    const { fixture, http } = crear();

    http.expectOne('/api/categorias/').flush(CATEGORIAS);
    http
      .expectOne('/api/productos/7/')
      .flush('no esta', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Este producto ya no existe');
    expect(elemento(fixture).querySelector('form')).toBeNull();
  });

  it('avisa cuando el backend no responde al guardar', async () => {
    const { fixture, http } = await conProducto();

    await enviar(fixture);
    http
      .expectOne('/api/productos/7/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos guardar los cambios');
  });
});
