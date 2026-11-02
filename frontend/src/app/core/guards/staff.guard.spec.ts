import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

import { Usuario } from '../models/usuario';
import { AuthService } from '../services/auth.service';
import { staffGuard } from './staff.guard';

function usuario(sobrescribir: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@example.com',
    telefono: '',
    is_staff: false,
    ...sobrescribir,
  };
}

describe('staffGuard', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
  });

  function ejecutar() {
    const resultado = TestBed.runInInjectionContext(() => staffGuard({} as never, {} as never));
    if (!isObservable(resultado)) {
      throw new Error('se esperaba un observable');
    }
    return firstValueFrom(resultado);
  }

  it('deja pasar a un usuario de personal', async () => {
    auth.verificando.set(false);
    auth.usuario.set(usuario({ is_staff: true }));

    expect(await ejecutar()).toBe(true);
  });

  it('rechaza a un cliente sin permisos de personal', async () => {
    auth.verificando.set(false);
    auth.usuario.set(usuario({ is_staff: false }));

    expect(await ejecutar()).toBeInstanceOf(UrlTree);
  });

  it('rechaza cuando no hay sesion iniciada', async () => {
    auth.verificando.set(false);
    auth.usuario.set(null);

    expect(await ejecutar()).toBeInstanceOf(UrlTree);
  });

  it('espera a que termine de verificar la sesion antes de decidir', async () => {
    auth.verificando.set(true);
    auth.usuario.set(null);

    const resultado = ejecutar();

    auth.usuario.set(usuario({ is_staff: true }));
    auth.verificando.set(false);
    TestBed.flushEffects();

    expect(await resultado).toBe(true);
  });
});
