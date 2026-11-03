import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PaginaPedidosCliente, Pedido } from '../../../core/models/pedido';
import { AuthService } from '../../../core/services/auth.service';
import { PedidoService, TAMANO_PAGINA_MIS_PEDIDOS } from '../../../core/services/pedido.service';
import { ResumenPedido } from '../resumen-pedido/resumen-pedido';

type EstadoLista = 'cargando' | 'ok' | 'error';
type EstadoConsulta = 'inicial' | 'consultando' | 'ok' | 'no-encontrado' | 'error';

/**
 * Estados del pedido para el cliente (FR-12). Con sesion lista sus pedidos;
 * con o sin sesion se puede consultar un pedido con su numero y el correo con
 * el que se hizo, que es lo que tiene quien compro sin cuenta.
 */
@Component({
  selector: 'app-mis-pedidos',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, ResumenPedido],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.scss',
})
export class MisPedidos {
  private readonly pedidos = inject(PedidoService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  readonly page = input(1, { transform: numberAttribute });
  /** Llega desde la confirmacion de compra para dejar el numero ya escrito. */
  readonly numero = input<number | null, unknown>(null, {
    transform: (valor: unknown) => (valor == null ? null : numberAttribute(valor, 0) || null),
  });

  protected readonly estadoLista = signal<EstadoLista>('cargando');
  protected readonly pagina = signal<PaginaPedidosCliente | null>(null);

  protected readonly paginaActual = computed(() => {
    const numero = this.page();
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1;
  });
  protected readonly filas = computed(() => this.pagina()?.results ?? []);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.pagina()?.count ?? 0) / TAMANO_PAGINA_MIS_PEDIDOS)),
  );
  protected readonly hayAnterior = computed(() => this.pagina()?.previous != null);
  protected readonly haySiguiente = computed(() => this.pagina()?.next != null);

  protected readonly estadoConsulta = signal<EstadoConsulta>('inicial');
  protected readonly consultado = signal<Pedido | null>(null);

  protected readonly formulario = this.fb.group({
    numero: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
  });

  constructor() {
    effect(() => {
      if (!this.auth.verificando() && this.auth.usuario()) {
        void this.cargar(this.paginaActual());
      }
    });

    effect(() => {
      const numero = this.numero();
      if (numero) {
        this.formulario.controls.numero.setValue(numero);
      }
    });

    effect(() => {
      // Con sesion, el correo mas probable es el de la cuenta.
      const usuario = this.auth.usuario();
      if (usuario && !this.formulario.controls.email.value) {
        this.formulario.controls.email.setValue(usuario.email);
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

  protected async consultar(): Promise<void> {
    const { numero, email } = this.formulario.getRawValue();
    if (this.formulario.invalid || numero == null) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.estadoConsulta.set('consultando');
    this.consultado.set(null);
    try {
      this.consultado.set(await firstValueFrom(this.pedidos.consultar(numero, email.trim())));
      this.estadoConsulta.set('ok');
    } catch (error) {
      this.estadoConsulta.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'no-encontrado' : 'error',
      );
    }
  }

  private async cargar(numero: number): Promise<void> {
    this.estadoLista.set('cargando');
    try {
      this.pagina.set(await firstValueFrom(this.pedidos.misPedidos(numero)));
      this.estadoLista.set('ok');
    } catch {
      this.pagina.set(null);
      this.estadoLista.set('error');
    }
  }
}
