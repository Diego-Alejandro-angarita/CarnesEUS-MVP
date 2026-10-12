import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PaginaUsuarios } from '../../../../core/models/usuario-admin';
import {
  AdminUsuariosService,
  TAMANO_PAGINA_USUARIOS,
} from '../../../../core/services/admin-usuarios.service';

type EstadoPantalla = 'cargando' | 'ok' | 'error';

@Component({
  selector: 'app-lista-usuarios',
  imports: [DatePipe],
  templateUrl: './lista-usuarios.html',
  styleUrl: './lista-usuarios.scss',
})
export class ListaUsuarios {
  private readonly admin = inject(AdminUsuariosService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly page = input(1, { transform: numberAttribute });

  protected readonly estado = signal<EstadoPantalla>('cargando');
  protected readonly pagina = signal<PaginaUsuarios | null>(null);
  /** Id del usuario cuyo cambio de estado esta en curso. */
  protected readonly cambiando = signal<number | null>(null);
  protected readonly errorAccion = signal('');

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
    } catch {
      this.errorAccion.set('No pudimos cambiar el estado de la cuenta. Intentalo de nuevo.');
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
