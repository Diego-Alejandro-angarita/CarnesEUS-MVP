import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea un monto como pesos colombianos.
 *
 * Los precios llegan como texto desde el backend (son Decimal, no float) para
 * que no pierdan exactitud en el camino; aqui se convierten solo para mostrar.
 */
@Pipe({ name: 'precioCop' })
export class PrecioCopPipe implements PipeTransform {
  private readonly formato = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

  transform(valor: string | number | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') {
      return '';
    }
    const numero = typeof valor === 'string' ? Number(valor) : valor;
    return Number.isNaN(numero) ? '' : this.formato.format(numero);
  }
}
