import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PaginaUsuarios } from '../../../../core/models/usuario-admin';
import { AuthService } from '../../../../core/services/auth.service';
import {
  AdminUsuariosService,
  TAMANO_PAGINA_USUARIOS,
} from '../../../../core/services/admin-usuarios.service';
import { TutorialService } from '../../../../core/tutorial/tutorial.service';
import { BotonTutorial } from '../../../../shared/boton-tutorial/boton-tutorial';

type EstadoPantalla = 'cargando' | 'ok' | 'error';

@Component({
  selector: 'app-lista-usuarios',
  imports: [DatePipe, BotonTutorial],
  templateUrl: './lista-usuarios.html',
  styleUrl: './lista-usuarios.scss',
})
export class ListaUsuarios {
  private readonly admin = inject(AdminUsuariosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly tutorial = inject(TutorialService);
  private readonly injector = inject(Injector);

  readonly page = input(1, { transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly pagina = signal<PaginaUsuarios | null>(null);
  /** Id del usuario cuyo cambio de estado esta en curso. */
  protected readonly cambiando = signal<number | null>(null);
  protected readonly errorAccion = signal('');
  /** El personal no puede desactivar su propia cuenta: se quedaria fuera del panel. */
  protected readonly miId = computed(() => this.auth.usuario()?.id ?? null);

  protected readonly paginaActual = computed(() => {
    const numero = this.page();
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1;
  });
  protected readonly usuarios = computed(() => this.pagina()?.results ?? []);
  protected readonly total = computed(() => this.pagina()?.count ?? 0);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA_USUARIOS)),
  );
  protected readonly hayAnterior = computed(() => this.pagina()?.previous != null);
  protected readonly haySiguiente = computed(() => this.pagina()?.next != null);

  constructor() {
    effect(() => void this.cargar(this.paginaActual()));

    effect(() => {
      if (this.estado() === 'ok') {
        afterNextRender(() => this.tutorial.iniciarSiPendiente('admin.usuarios'), {
          injector: this.injector,
        });
      }
    });
  }

  protected irA(numero: number): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { page: numero > 1 ? numero : null },
      queryParamsHandling: 'merge',
    });
  }

  protected async alternarActivo(id: number, activo: boolean): Promise<void> {
    this.errorAccion.set('');
    this.cambiando.set(id);

    try {
      const usuario = await firstValueFrom(this.admin.cambiarActivo(id, !activo));
      this.pagina.update((pagina) =>
        pagina
          ? {
              ...pagina,
              results: pagina.results.map((item) =>
                item.id === id ? { ...item, is_active: usuario.is_active } : item,
              ),
            }
          : pagina,
      );
    } catch (error) {
      const motivo =
        error instanceof HttpErrorResponse && error.status === 400
          ? error.error?.is_active?.[0]
          : undefined;
      this.errorAccion.set(
        motivo ?? 'No pudimos cambiar el estado de la cuenta. Intentalo de nuevo.',
      );
    } finally {
      this.cambiando.set(null);
    }
  }

  private async cargar(numero: number): Promise<void> {
    this.estado.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.admin.listar(numero)));
      this.estado.set('ok');
    } catch {
      this.pagina.set(null);
      this.estado.set('error');
    }
  }
}
