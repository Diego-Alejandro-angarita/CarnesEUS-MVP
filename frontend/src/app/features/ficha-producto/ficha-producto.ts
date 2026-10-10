import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PaginaResenas, PuedeResenar, Resena } from '../../core/models/resena';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { ResenaService } from '../../core/services/resena.service';
import { CatalogoService, Producto } from '../catalogo/catalogo.service';

type EstadoFicha = 'cargando' | 'ok' | 'no-encontrado' | 'error';
type EstadoAgregar = 'listo' | 'enviando' | 'agregado' | 'error';
type EstadoResenas = 'cargando' | 'ok' | 'error';

@Component({
  selector: 'app-ficha-producto',
  imports: [CurrencyPipe, RouterLink, ReactiveFormsModule],
  templateUrl: './ficha-producto.html',
  styleUrl: './ficha-producto.scss',
})
export class FichaProducto {
  private readonly catalogo = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  private readonly resenasApi = inject(ResenaService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  readonly slug = input.required<string>();

  protected readonly estado = signal<EstadoFicha>('cargando');
  protected readonly producto = signal<Producto | null>(null);
  protected readonly estadoAgregar = signal<EstadoAgregar>('listo');
  protected readonly cantidad = signal(1);

  // --- resenas (FR-18) ---------------------------------------------------
  protected readonly estadoResenas = signal<EstadoResenas>('cargando');
  protected readonly paginaResenas = signal<PaginaResenas | null>(null);
  protected readonly paginaResenasActual = signal(1);
  protected readonly puedeResenarInfo = signal<PuedeResenar | null>(null);
  /** Id de la resena propia en edicion; null es el formulario para una nueva. */
  protected readonly editandoId = signal<number | null>(null);
  protected readonly confirmandoEliminar = signal<number | null>(null);
  protected readonly enviandoResena = signal(false);
  protected readonly errorResena = signal<string | null>(null);

  protected readonly resenas = computed(() => this.paginaResenas()?.results ?? []);
  protected readonly hayResenaAnterior = computed(() => this.paginaResenas()?.previous != null);
  protected readonly hayResenaSiguiente = computed(() => this.paginaResenas()?.next != null);

  protected readonly formularioResena = this.fb.nonNullable.group({
    calificacion: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comentario: [''],
  });

  protected readonly ESTRELLAS = [1, 2, 3, 4, 5];

  constructor() {
    effect(() => {
      void this.cargar(this.slug());
    });
    effect(() => {
      void this.cargarResenas(this.slug(), this.paginaResenasActual());
    });
    effect(() => {
      void this.cargarPuedeResenar(this.slug(), this.auth.usuario()?.id ?? null);
    });
  }

  protected cambiarCantidad(delta: number): void {
    this.cantidad.update((actual) => Math.max(1, actual + delta));
  }

  protected async agregar(): Promise<void> {
    const producto = this.producto();
    if (!producto) {
      return;
    }

    this.estadoAgregar.set('enviando');
    try {
      await this.carrito.agregar(producto.id, this.cantidad());
      this.estadoAgregar.set('agregado');
      this.cantidad.set(1);
      // El aviso de confirmacion se apaga solo: dejarlo fijo confunde si el
      // visitante agrega otro producto despues.
      setTimeout(() => {
        if (this.estadoAgregar() === 'agregado') {
          this.estadoAgregar.set('listo');
        }
      }, 3000);
    } catch {
      this.estadoAgregar.set('error');
    }
  }

  private async cargar(slug: string): Promise<void> {
    this.estado.set('cargando');
    try {
      this.producto.set(await firstValueFrom(this.catalogo.obtener(slug)));
      this.estado.set('ok');
    } catch (error: unknown) {
      this.producto.set(null);
      const esNoEncontrado = error instanceof HttpErrorResponse && error.status === 404;
      this.estado.set(esNoEncontrado ? 'no-encontrado' : 'error');
    }
  }

  // --- resenas (FR-18) -----------------------------------------------------

  protected redondear(valor: number | null): number {
    return Math.round(valor ?? 0);
  }

  protected irAPaginaResenas(numero: number): void {
    this.paginaResenasActual.set(numero);
  }

  protected comenzarEdicion(resena: Resena): void {
    this.editandoId.set(resena.id);
    this.errorResena.set(null);
    this.formularioResena.setValue({
      calificacion: resena.calificacion,
      comentario: resena.comentario,
    });
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
    this.errorResena.set(null);
    this.formularioResena.reset({ calificacion: 5, comentario: '' });
  }

  protected pedirConfirmacionEliminar(id: number): void {
    this.confirmandoEliminar.set(id);
  }

  protected cancelarEliminar(): void {
    this.confirmandoEliminar.set(null);
  }

  protected async enviarResena(): Promise<void> {
    if (this.formularioResena.invalid) {
      this.formularioResena.markAllAsTouched();
      return;
    }

    const slug = this.slug();
    const idEnEdicion = this.editandoId();
    this.enviandoResena.set(true);
    this.errorResena.set(null);

    try {
      const datos = this.formularioResena.getRawValue();
      if (idEnEdicion != null) {
        await firstValueFrom(this.resenasApi.editar(idEnEdicion, datos));
      } else {
        await firstValueFrom(this.resenasApi.crear(slug, datos));
      }
      this.cancelarEdicion();
      await Promise.all([
        this.cargarResenas(slug, this.paginaResenasActual()),
        this.cargarPuedeResenar(slug, this.auth.usuario()?.id ?? null),
      ]);
    } catch (error: unknown) {
      this.errorResena.set(this.mensajeDeErrorResena(error));
    } finally {
      this.enviandoResena.set(false);
    }
  }

  protected async eliminarResena(id: number): Promise<void> {
    const slug = this.slug();
    try {
      await firstValueFrom(this.resenasApi.eliminar(id));
      this.confirmandoEliminar.set(null);
      await Promise.all([
        this.cargarResenas(slug, this.paginaResenasActual()),
        this.cargarPuedeResenar(slug, this.auth.usuario()?.id ?? null),
      ]);
    } catch {
      this.confirmandoEliminar.set(null);
      this.errorResena.set('No pudimos eliminar tu reseña. Intentalo de nuevo.');
    }
  }

  private async cargarResenas(slug: string, pagina: number): Promise<void> {
    this.estadoResenas.set('cargando');
    try {
      this.paginaResenas.set(await firstValueFrom(this.resenasApi.listar(slug, pagina)));
      this.estadoResenas.set('ok');
    } catch {
      this.paginaResenas.set(null);
      this.estadoResenas.set('error');
    }
  }

  /** usuarioId solo dispara de nuevo el effect cuando cambia la sesion. */
  private async cargarPuedeResenar(slug: string, usuarioId: number | null): Promise<void> {
    if (usuarioId == null) {
      this.puedeResenarInfo.set(null);
      return;
    }
    try {
      this.puedeResenarInfo.set(await firstValueFrom(this.resenasApi.puedeResenar(slug)));
    } catch {
      this.puedeResenarInfo.set(null);
    }
  }

  private mensajeDeErrorResena(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const datos = error.error as { detail?: string; calificacion?: string[] } | undefined;
      if (datos?.detail) {
        return datos.detail;
      }
      if (datos?.calificacion?.length) {
        return datos.calificacion[0];
      }
    }
    return 'No pudimos guardar tu reseña. Intentalo de nuevo.';
  }
}