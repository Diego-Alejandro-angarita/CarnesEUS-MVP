import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Usuario } from '../models/usuario';
import { AuthService } from '../services/auth.service';
import { TutorialService } from './tutorial.service';
import { ClaveTutorial, TUTORIALES } from './tutoriales';

const URL = '/api/auth/tutoriales/vistos/';

/** Lista del backend escrita a mano (doc 4.1) para detectar divergencias. */
const CLAVES_BACKEND: ClaveTutorial[] = [
  'cliente',
  'admin.bienvenida',
  'admin.panel',
  'admin.productos',
  'admin.producto-formulario',
  'admin.promociones',
  'admin.pedidos',
  'admin.pedido-detalle',
  'admin.usuarios',
  'admin.estadisticas',
];

function usuario(sobrescribir: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@example.com',
    telefono: '',
    is_staff: false,
    tutoriales_vistos: [],
    ...sobrescribir,
  };
}

describe('TutorialService', () => {
  let servicio: TutorialService;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    servicio = TestBed.inject(TutorialService);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    // quien-soy del arranque de AuthService no se dispara aqui: AuthService no
    // lo llama en su constructor, solo App lo hace. No hay peticiones pendientes.
  });

  afterEach(() => {
    http.verify();
    document.querySelectorAll('.ancla-prueba').forEach((el) => el.remove());
  });

  /** Inserta un elemento con data-tutorial para que el paso no se omita. */
  function anclar(ancla: string): void {
    const el = document.createElement('div');
    el.setAttribute('data-tutorial', ancla);
    el.className = 'ancla-prueba';
    document.body.appendChild(el);
  }

  describe('pendiente()', () => {
    it('es falso sin usuario', () => {
      expect(servicio.pendiente('cliente')).toBe(false);
    });

    it('es falso si la clave ya esta vista', () => {
      auth.usuario.set(usuario({ tutoriales_vistos: ['cliente'] }));
      expect(servicio.pendiente('cliente')).toBe(false);
    });

    it('es falso para admin.* si no es staff', () => {
      auth.usuario.set(usuario({ is_staff: false }));
      expect(servicio.pendiente('admin.panel')).toBe(false);
    });

    it('es falso para cliente si es staff', () => {
      auth.usuario.set(usuario({ is_staff: true }));
      expect(servicio.pendiente('cliente')).toBe(false);
    });

    it('es verdadero para cliente si no es staff y no lo ha visto', () => {
      auth.usuario.set(usuario({ is_staff: false }));
      expect(servicio.pendiente('cliente')).toBe(true);
    });
  });

  describe('saltar()', () => {
    it('agrega la clave al usuario antes de que responda el POST y envia {claves:[clave]}', () => {
      auth.usuario.set(usuario({ is_staff: false }));
      anclar('catalogo-busqueda');
      servicio.iniciarSiPendiente('cliente');
      servicio.saltar();

      // El usuario ya tiene la clave aunque el POST no haya respondido.
      expect(auth.usuario()!.tutoriales_vistos).toContain('cliente');

      const req = http.expectOne(URL);
      expect(req.request.body).toEqual({ claves: ['cliente'] });
      req.flush(usuario({ tutoriales_vistos: ['cliente'] }));
    });
  });

  describe('irAlPanel()', () => {
    it('marca la clave activa, la envia y navega a /admin', () => {
      const router = TestBed.inject(Router);
      const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      auth.usuario.set(usuario({ is_staff: true }));
      anclar('cabecera-administrar');
      servicio.iniciarSiPendiente('admin.bienvenida');
      servicio.irAlPanel();

      // El usuario queda con la clave antes de navegar, y el tutorial se cierra.
      expect(auth.usuario()!.tutoriales_vistos).toContain('admin.bienvenida');
      expect(servicio.activo()).toBeNull();
      expect(navegar).toHaveBeenCalledWith('/admin');

      const req = http.expectOne(URL);
      expect(req.request.body).toEqual({ claves: ['admin.bienvenida'] });
      req.flush(usuario({ is_staff: true, tutoriales_vistos: ['admin.bienvenida'] }));
    });
  });

  describe('noMostrarMas()', () => {
    it('envia todas las claves admin.*', () => {
      auth.usuario.set(usuario({ is_staff: true }));
      servicio.ver('admin.panel');
      servicio.noMostrarMas();

      const req = http.expectOne(URL);
      const esperadas = CLAVES_BACKEND.filter((c) => c.startsWith('admin.'));
      expect([...req.request.body.claves].sort()).toEqual([...esperadas].sort());
      req.flush(usuario({ is_staff: true, tutoriales_vistos: esperadas }));
    });
  });

  describe('ver()', () => {
    it('abre un tutorial ya visto y no hace peticiones al cerrarlo', () => {
      auth.usuario.set(usuario({ is_staff: true, tutoriales_vistos: ['admin.estadisticas'] }));
      anclar('estadisticas-ventas');
      servicio.ver('admin.estadisticas');
      expect(servicio.activo()).toBe('admin.estadisticas');

      // Cerrar lo abierto con ver() no debe tocar el backend.
      servicio.saltar();
      expect(servicio.activo()).toBeNull();
      http.expectNone(URL);
    });
  });

  describe('iniciarSiPendiente()', () => {
    it('no abre nada ni hace peticiones si ningun ancla esta en el DOM', () => {
      auth.usuario.set(usuario({ is_staff: true }));
      // admin.productos tiene pasos con ancla; sin anclas en el DOM no abre.
      servicio.iniciarSiPendiente('admin.productos');

      expect(servicio.activo()).toBeNull();
      http.expectNone(URL);
    });
  });

  it('las claves coinciden con la lista del backend', () => {
    expect(Object.keys(TUTORIALES)).toEqual(CLAVES_BACKEND);
  });
});
