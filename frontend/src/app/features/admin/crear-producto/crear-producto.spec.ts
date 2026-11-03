import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CrearProducto } from './crear-producto';

const CATEGORIAS = [
  { id: 1, nombre: 'Res', slug: 'res' },
  { id: 2, nombre: 'Cerdo', slug: 'cerdo' },
];

function creado(sobrescribir: Record<string, unknown> = {}) {
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

describe('CrearProducto', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearProducto],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(CrearProducto);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  /** Responde la peticion de categorias y deja el formulario pintado. */
  async function conFormulario() {
    const { fixture, http } = crear();
    http.expectOne('/api/categorias/').flush(CATEGORIAS);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function elemento(fixture: ComponentFixture<CrearProducto>) {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<CrearProducto>) {
    return elemento(fixture).textContent ?? '';
  }

  function escribir(fixture: ComponentFixture<CrearProducto>, id: string, valor: string) {
    const campo = elemento(fixture).querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  /** Rellena los campos obligatorios con datos validos. */
  async function rellenar(fixture: ComponentFixture<CrearProducto>) {
    const select = elemento(fixture).querySelector<HTMLSelectElement>('#categoria')!;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    escribir(fixture, 'nombre', 'Lomo fino');
    escribir(fixture, 'presentacion', 'Bandeja 500 g');
    escribir(fixture, 'precio', '38900');
    await fixture.whenStable();
  }

  // La aplicacion corre sin zone.js. Se espera a whenStable() en vez de forzar
  // detectChanges(): asi la prueba falla si el componente no programa el
  // refresco por su cuenta.
  async function enviar(fixture: ComponentFixture<CrearProducto>) {
    elemento(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('pide las categorias al arrancar', () => {
    const { http } = crear();

    expect(http.expectOne('/api/categorias/').request.method).toBe('GET');
  });

  it('llena el selector con las categorias que devuelve el backend', async () => {
    const { fixture } = await conFormulario();

    const opciones = elemento(fixture).querySelectorAll('#categoria option');
    expect(opciones.length).toBe(3);
    expect(opciones[1].textContent).toContain('Res');
  });

  it('no envia nada si faltan campos obligatorios y marca los errores', async () => {
    const { fixture, http } = await conFormulario();

    await enviar(fixture);

    http.expectNone('/api/productos/');
    expect(texto(fixture)).toContain('Elige una categoria.');
    expect(texto(fixture)).toContain('Este campo es obligatorio.');
  });

  it('rechaza un precio que no sea mayor que cero sin llamar al backend', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    escribir(fixture, 'precio', '0');
    await enviar(fixture);

    http.expectNone('/api/productos/');
    expect(texto(fixture)).toContain('El precio debe ser mayor que cero.');
  });

  it('envia el producto al backend con los datos del formulario', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);

    const peticion = http.expectOne('/api/productos/');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      categoria: 1,
      nombre: 'Lomo fino',
      descripcion: '',
      presentacion: 'Bandeja 500 g',
      precio: 38900,
      foto_url: '',
      disponible: true,
    });
  });

  it('confirma la creacion y permite crear otro producto', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http.expectOne('/api/productos/').flush(creado(), { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Producto creado');
    expect(texto(fixture)).toContain('Lomo fino');

    elemento(fixture).querySelector<HTMLButtonElement>('.exito button')!.click();
    await fixture.whenStable();

    expect(elemento(fixture).querySelector('form')).toBeTruthy();
    expect(elemento(fixture).querySelector<HTMLInputElement>('#nombre')!.value).toBe('');
  });

  it('muestra bajo cada campo los errores que devuelve el backend', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http
      .expectOne('/api/productos/')
      .flush(
        { nombre: ['Ya existe un producto con este nombre.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Ya existe un producto con este nombre.');
    expect(elemento(fixture).querySelector('form')).toBeTruthy();
  });

  it('avisa cuando el backend no responde al guardar', async () => {
    const { fixture, http } = await conFormulario();

    await rellenar(fixture);
    await enviar(fixture);
    http
      .expectOne('/api/productos/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos guardar el producto');
  });

  it('avisa cuando no puede cargar las categorias', async () => {
    const { fixture, http } = crear();

    http
      .expectOne('/api/categorias/')
      .flush('sin backend', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar las categorias');
  });

  it('avisa cuando todavia no hay categorias registradas', async () => {
    const { fixture, http } = crear();

    http.expectOne('/api/categorias/').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No hay categorias registradas');
    expect(elemento(fixture).querySelector('form')).toBeNull();
  });
});
