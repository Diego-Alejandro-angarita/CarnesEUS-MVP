import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/mensajes';
import { Direccion, Pedido } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { PagosService } from '../../core/services/pagos.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, PrecioCopPipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly auth = inject(AuthService);
  private readonly carritoService = inject(CarritoService);
  private readonly pedidos = inject(PedidosService);
  private readonly pagos = inject(PagosService);
  private readonly router = inject(Router);

  protected readonly carrito = this.carritoService.carrito;
  protected readonly direcciones = signal<Direccion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly paso = signal<'datos' | 'procesando' | 'verificando'>('datos');

  /**
   * El pedido ya creado, si lo hay.
   *
   * Se guarda para que reintentar el pago tras un rechazo no genere un pedido
   * duplicado: se vuelve a cobrar el mismo.
   */
  protected readonly pedido = signal<Pedido | null>(null);

  protected direccionId: number | null = null;
  protected notas = '';
  protected mostrarFormularioDireccion = false;
  protected nuevaDireccion = { etiqueta: 'Casa', ciudad: 'Medellin', barrio: '', direccion: '', notas: '' };

  protected readonly direccionElegida = computed(() =>
    this.direcciones().find((d) => d.id === this.direccionId) ?? null,
  );

  /** El backend rechaza el pedido fuera de cobertura; aqui se avisa antes. */
  protected readonly fueraDeCobertura = computed(() => {
    const direccion = this.direccionElegida();
    return direccion !== null && !direccion.en_zona_cobertura;
  });

  protected readonly puedePagar = computed(
    () =>
      this.direccionId !== null &&
      !this.fueraDeCobertura() &&
      (this.carrito()?.items.length ?? 0) > 0 &&
      this.paso() === 'datos',
  );

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const [direcciones] = await Promise.all([
        firstValueFrom(this.auth.direcciones()),
        this.carritoService.cargar(),
      ]);
      this.direcciones.set(direcciones);
      this.direccionId =
        direcciones.find((d) => d.es_principal)?.id ?? direcciones[0]?.id ?? null;
      this.mostrarFormularioDireccion = direcciones.length === 0;
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo preparar el checkout.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardarDireccion(): Promise<void> {
    this.error.set('');
    try {
      const creada = await firstValueFrom(this.auth.crearDireccion(this.nuevaDireccion));
      this.direcciones.update((lista) => [...lista, creada]);
      this.direccionId = creada.id;
      this.mostrarFormularioDireccion = false;
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo guardar la direccion.'));
    }
  }

  /**
   * Flujo completo: pedido -> datos firmados -> Widget -> verificacion.
   *
   * Lo que el Widget devuelve no se toma como prueba de pago; solo se usa para
   * pedirle al backend que consulte a Wompi, que es quien tiene la verdad.
   */
  protected async pagar(): Promise<void> {
    if (!this.puedePagar() || this.direccionId === null) {
      return;
    }

    this.error.set('');
    this.paso.set('procesando');

    try {
      let pedido = this.pedido();
      if (!pedido) {
        pedido = await firstValueFrom(this.pedidos.crear(this.direccionId, this.notas));
        this.pedido.set(pedido);
        // El backend ya cerro el carrito al crear el pedido.
        await this.carritoService.cargar();
      }

      const datos = await this.pagos.datosDeCheckout(pedido.id);
      const transactionId = await this.pagos.abrirWidget(datos);

      this.paso.set('verificando');
      await this.pagos.verificar(pedido.id, transactionId);

      await this.router.navigate(['/pedidos', pedido.id]);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo completar el pago.'));
      this.paso.set('datos');
    }
  }
}
