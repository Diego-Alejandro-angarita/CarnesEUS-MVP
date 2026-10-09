import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MetodoPago, Pedido } from '../../core/models/pedido';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { PedidoService } from '../../core/services/pedido.service';

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
  private readonly auth = inject(AuthService);

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
        // El backend vacio el carrito: se actualiza el contador de la cabecera.
        void this.carritoServicio.refrescar();
      },
      error: (respuesta: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(respuesta));
      },
    });
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