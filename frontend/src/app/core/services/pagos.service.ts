import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DatosWidget, ResultadoVerificacion } from '../models';

const URL_WIDGET = 'https://checkout.wompi.co/widget.js';

/** Lo que el Widget devuelve en su callback. */
interface ResultadoWidget {
  transaction?: { id: string; status: string; reference: string };
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => {
      open: (callback: (resultado: ResultadoWidget) => void) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly http = inject(HttpClient);

  /** Se guarda la promesa, no un booleano: dos llamadas seguidas no deben
   *  inyectar el script dos veces. */
  private cargaDelWidget?: Promise<void>;

  /**
   * Carga widget.js bajo demanda.
   *
   * No va en index.html a proposito: quien solo mira el catalogo no tiene por
   * que descargar el script de la pasarela.
   */
  private cargarWidget(): Promise<void> {
    if (window.WidgetCheckout) {
      return Promise.resolve();
    }
    this.cargaDelWidget ??= new Promise<void>((resolver, rechazar) => {
      const script = document.createElement('script');
      script.src = URL_WIDGET;
      script.async = true;
      script.onload = () => resolver();
      script.onerror = () => {
        // Se descarta para que un segundo intento vuelva a probar.
        this.cargaDelWidget = undefined;
        rechazar(new Error('No se pudo cargar el widget de pagos de Wompi.'));
      };
      document.head.appendChild(script);
    });
    return this.cargaDelWidget;
  }

  /** Pide al backend los datos firmados del intento de pago. */
  datosDeCheckout(pedidoId: number): Promise<DatosWidget> {
    return firstValueFrom(
      this.http.post<DatosWidget>(`/api/pedidos/${pedidoId}/checkout/`, {}),
    );
  }

  /**
   * Abre el Widget y devuelve el id de transaccion que reporta.
   *
   * Ese id NO es prueba de pago: cualquiera puede invocar el callback desde la
   * consola del navegador. Sirve unicamente para pedirle al backend que
   * consulte a Wompi. La verdad la tiene el servidor.
   */
  async abrirWidget(datos: DatosWidget): Promise<string | null> {
    await this.cargarWidget();

    const WidgetCheckout = window.WidgetCheckout;
    if (!WidgetCheckout) {
      throw new Error('El widget de pagos no quedo disponible.');
    }

    return new Promise<string | null>((resolver) => {
      const checkout = new WidgetCheckout({
        currency: datos.currency,
        amountInCents: datos.amountInCents,
        reference: datos.reference,
        publicKey: datos.publicKey,
        // La firma se calcula en el servidor; aqui solo se transporta.
        signature: { integrity: datos.signature },
        redirectUrl: datos.redirectUrl,
        customerData: datos.customerData,
        shippingAddress: datos.shippingAddress,
      });

      checkout.open((resultado) => resolver(resultado?.transaction?.id ?? null));
    });
  }

  /** Reconciliacion contra Wompi. Es el unico resultado en el que se confia. */
  verificar(pedidoId: number, transactionId: string | null): Promise<ResultadoVerificacion> {
    return firstValueFrom(
      this.http.post<ResultadoVerificacion>(`/api/pedidos/${pedidoId}/verificar-pago/`, {
        transaction_id: transactionId ?? '',
      }),
    );
  }
}
