import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Usuario } from '../../core/models/usuario';
import { AuthService } from '../../core/services/auth.service';
import { TutorialService } from '../../core/tutorial/tutorial.service';
import { Tutorial } from './tutorial';

function usuario(sobrescribir: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@example.com',
    telefono: '',
    is_staff: true,
    tutoriales_vistos: [],
    ...sobrescribir,
  };
}

describe('Tutorial', () => {
  let fixture: ComponentFixture<Tutorial>;
  let tutorial: TutorialService;
  let auth: AuthService;

  beforeEach(async () => {
    // jsdom no implementa scrollIntoView; la medicion del recuadro lo llama.
    Element.prototype.scrollIntoView = () => undefined;

    await TestBed.configureTestingModule({
      imports: [Tutorial],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    tutorial = TestBed.inject(TutorialService);
    auth = TestBed.inject(AuthService);
    auth.usuario.set(usuario());

    // Las anclas de los pasos de admin.panel deben existir en el DOM, si no el
    // servicio omite esos pasos y el recorrido se queda en el unico sin ancla.
    for (const ancla of [
      'panel-productos',
      'panel-pedidos',
      'panel-usuarios',
      'panel-estadisticas',
      'cabecera-administrar',
    ]) {
      const el = document.createElement('div');
      el.setAttribute('data-tutorial', ancla);
      el.className = 'ancla-prueba';
      document.body.appendChild(el);
    }

    fixture = TestBed.createComponent(Tutorial);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('.ancla-prueba').forEach((el) => el.remove());
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('no muestra nada cuando no hay tutorial activo', () => {
    expect(raiz().querySelector('.tutorial')).toBeNull();
  });

  it('muestra "Paso n de m" y los textos del paso', () => {
    tutorial.ver('admin.panel');
    fixture.detectChanges();

    expect(texto()).toContain('Paso 1 de 6');
    expect(texto()).toContain('Bienvenido al panel');
  });

  it('Siguiente y Anterior cambian el paso', () => {
    tutorial.ver('admin.panel');
    fixture.detectChanges();

    const siguiente = raiz().querySelector<HTMLButtonElement>('.tutorial__boton--principal')!;
    siguiente.click();
    fixture.detectChanges();
    expect(texto()).toContain('Paso 2 de 6');

    const anterior = raiz().querySelector<HTMLButtonElement>('.tutorial__boton')!;
    anterior.click();
    fixture.detectChanges();
    expect(texto()).toContain('Paso 1 de 6');
  });

  it('Saltar cierra el tutorial', () => {
    tutorial.ver('admin.panel');
    fixture.detectChanges();

    const enlaces = [...raiz().querySelectorAll<HTMLButtonElement>('.tutorial__enlace')];
    const saltar = enlaces.find((e) => e.textContent?.includes('Saltar'))!;
    saltar.click();
    fixture.detectChanges();

    expect(raiz().querySelector('.tutorial')).toBeNull();
  });

  it('Esc cierra el tutorial', () => {
    tutorial.ver('admin.panel');
    fixture.detectChanges();

    const contenedor = raiz().querySelector<HTMLElement>('.tutorial')!;
    contenedor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(raiz().querySelector('.tutorial')).toBeNull();
  });

  it('devuelve el foco al elemento previo al cerrar', () => {
    const previo = document.createElement('button');
    document.body.appendChild(previo);
    previo.focus();
    expect(document.activeElement).toBe(previo);

    tutorial.ver('admin.panel');
    fixture.detectChanges();

    const saltar = [...raiz().querySelectorAll<HTMLButtonElement>('.tutorial__enlace')].find((e) =>
      e.textContent?.includes('Saltar'),
    )!;
    saltar.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(previo);
    previo.remove();
  });
});
