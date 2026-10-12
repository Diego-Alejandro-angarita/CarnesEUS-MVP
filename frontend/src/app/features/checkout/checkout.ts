import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ItemPedido, MetodoPago, Pedido } from '../../core/models/pedido';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { PedidoService } from '../../core/services/pedido.service';
import { ResenaService } from '../../core/services/resena.service';

const METODOS: { valor: MetodoPago; nombre: string; ayuda: string }[] = [
  {
    valor: 'transferencia',
    nombre: 'Transferencia',
    ayuda: 'Pagas por transferencia y verificamos tu pago.',
  },
  {
    valor: 'contraentrega_qr',
    nombre: 'Contraentrega con QR',
    ayuda: 'Pagas con un codigo QR cuando recibes el pedido.',
  },
  {
    valor: 'contraentrega_datafono',
    nombre: 'Contraentrega con datafono',
    ayuda: 'Pagas con tarjeta en el datafono cuando recibes el pedido.',
  },
];

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly fb = inject(FormBuilder);
  private readonly pedidos = inject(PedidoService);
  private readonly carritoServicio = inject(CarritoService);
  private readonly resenas = inject(ResenaService);
  protected readonly auth = inject(AuthService);

  protected readonly metodos = METODOS;
  protected readonly cargandoCarrito = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Cuando la compra sale bien se muestra la confirmacion en vez del formulario. */
  protected readonly pedido = signal<Pedido | null>(null);

  protected readonly items = computed(
    () => this.carritoServicio.carrito()?.items.filter((item) => item.comprable) ?? [],
  );
  protected readonly total = this.carritoServicio.total;

  // --- calificar lo recien comprado (FR-18) ---------------------------------
  protected readonly itemsPedido = computed(() => this.pedido()?.items ?? []);
  protected readonly productoSeleccionado = signal<number | null>(null);
  protected readonly itemSeleccionado = computed<ItemPedido | null>(
    () => this.itemsPedido().find((item) => item.producto_id === this.productoSeleccionado()) ?? null,
  );
  protected readonly resenasEnviadas = signal<ReadonlySet<number>>(new Set());
  protected readonly enviandoResena = signal(false);
  protected readonly errorResena = signal<string | null>(null);

  protected readonly formularioResena = this.fb.nonNullable.group({
    calificacion: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comentario: [''],
  });

  protected readonly formulario = this.fb.nonNullable.group({
    metodo_pago: ['transferencia' as MetodoPago, Validators.required],
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    direccion: ['', Validators.required],
    municipio: ['', Validators.required],
    barrio: ['', Validators.required],
    notas: [''],
  });

  constructor() {
    // Si ya inicio sesion, se adelantan sus datos de contacto.
    const usuario = this.auth.usuario();
    if (usuario) {
      this.formulario.patchValue({
        nombre: `${usuario.first_name} ${usuario.last_name}`.trim(),
        email: usuario.email,
        telefono: usuario.telefono,
      });
    }

    void this.cargarCarrito();
  }

  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.pedidos.crear(this.formulario.getRawValue()).subscribe({
      next: (pedido) => {
        this.enviando.set(false);
        this.pedido.set(pedido);
        this.productoSeleccionado.set(pedido.items[0]?.producto_id ?? null);
        // El backend vacio el carrito: se actualiza el contador de la cabecera.
        void this.carritoServicio.refrescar();
      },
      error: (respuesta: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(respuesta));
      },
    });
  }

  // --- calificar lo recien comprado (FR-18) ---------------------------------

  protected seleccionarProducto(id: number): void {
    this.productoSeleccionado.set(id);
    this.errorResena.set(null);
    this.formularioResena.reset({ calificacion: 5, comentario: '' });
  }

  protected async enviarResena(): Promise<void> {
    const item = this.itemSeleccionado();
    if (!item) {
      return;
    }
    if (this.formularioResena.invalid) {
      this.formularioResena.markAllAsTouched();
      return;
    }

    this.enviandoResena.set(true);
    this.errorResena.set(null);

    try {
      await firstValueFrom(this.resenas.crear(item.producto_slug, this.formularioResena.getRawValue()));
      const enviadas = new Set(this.resenasEnviadas()).add(item.producto_id);
      this.resenasEnviadas.set(enviadas);
      this.formularioResena.reset({ calificacion: 5, comentario: '' });
      // Adelanta la seleccion al siguiente producto que todavia no se califico.
      const siguiente = this.itemsPedido().find((i) => !enviadas.has(i.producto_id));
      this.productoSeleccionado.set(siguiente?.producto_id ?? item.producto_id);
    } catch (error: unknown) {
      this.errorResena.set(this.mensajeDeErrorResena(error));
    } finally {
      this.enviandoResena.set(false);
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

  private async cargarCarrito(): Promise<void> {
    try {
      await this.carritoServicio.refrescar();
    } catch {
      this.error.set('No pudimos cargar tu carrito. Revisa tu conexion e intentalo de nuevo.');
    } finally {
      this.cargandoCarrito.set(false);
    }
  }
}

/** Saca el primer mensaje legible de la respuesta de error del backend. */
function mensajeDeError(respuesta: HttpErrorResponse): string {
  return primerMensaje(respuesta.error) ?? 'No pudimos procesar tu pedido. Intentalo de nuevo.';
}

function primerMensaje(valor: unknown): string | null {
  if (typeof valor === 'string') {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.length > 0 ? primerMensaje(valor[0]) : null;
  }
  if (valor && typeof valor === 'object') {
    for (const interno of Object.values(valor)) {
      const mensaje = primerMensaje(interno);
      if (mensaje) {
        return mensaje;
      }
    }
  }
  return null;
}