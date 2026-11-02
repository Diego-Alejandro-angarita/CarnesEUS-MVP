import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EtapaPedido, PasoSeguimiento } from '../../../core/models/pedido';
import { SeguimientoPedido } from './seguimiento-pedido';

registerLocaleData(localeEsCo);

const NOMBRES: Record<EtapaPedido, string> = {
  recibido: 'Recibido',
  en_preparacion: 'En preparacion',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function paso(etapa: EtapaPedido, fecha: string): PasoSeguimiento {
  return { etapa, etapa_nombre: NOMBRES[etapa], fecha };
}

describe('SeguimientoPedido', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeguimientoPedido],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }],
    }).compileComponents();
  });

  function crear(etapa: EtapaPedido, seguimiento: PasoSeguimiento[]) {
    const fixture = TestBed.createComponent(SeguimientoPedido);
    fixture.componentRef.setInput('pedido', { etapa, seguimiento });
    fixture.detectChanges();
    return fixture;
  }

  function pasos(fixture: ComponentFixture<SeguimientoPedido>) {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>('li')];
  }

  it('muestra las cuatro etapas del flujo con la actual marcada', () => {
    const fixture = crear('en_preparacion', [
      paso('recibido', '2026-10-08T12:00:00Z'),
      paso('en_preparacion', '2026-10-08T13:00:00Z'),
    ]);

    const lista = pasos(fixture);
    expect(lista.map((li) => li.querySelector('.paso__nombre')?.textContent?.trim())).toEqual([
      'Recibido',
      'En preparacion',
      'En camino',
      'Entregado',
    ]);
    expect(lista[0].classList).toContain('paso--hecho');
    expect(lista[1].getAttribute('aria-current')).toBe('step');
    expect(lista[2].classList).toContain('paso--pendiente');
  });

  it('pone la fecha a las etapas cumplidas y "Pendiente" a las que faltan', () => {
    const fixture = crear('recibido', [paso('recibido', '2026-10-08T12:00:00Z')]);

    const lista = pasos(fixture);
    expect(lista[0].textContent).toContain('8 oct');
    expect(lista[3].textContent).toContain('Pendiente');
  });

  it('explica que significa la etapa actual', () => {
    const fixture = crear('en_camino', [
      paso('recibido', '2026-10-08T12:00:00Z'),
      paso('en_preparacion', '2026-10-08T13:00:00Z'),
      paso('en_camino', '2026-10-08T14:00:00Z'),
    ]);

    expect(fixture.nativeElement.textContent).toContain('va camino a la direccion de entrega');
  });

  it('con un pedido cancelado no muestra las etapas que ya no van a pasar', () => {
    const fixture = crear('cancelado', [
      paso('recibido', '2026-10-08T12:00:00Z'),
      paso('cancelado', '2026-10-08T12:30:00Z'),
    ]);

    const lista = pasos(fixture);
    expect(lista.length).toBe(2);
    expect(lista[1].classList).toContain('paso--cancelado');
    expect(lista[1].getAttribute('aria-current')).toBe('step');
    expect(fixture.nativeElement.textContent).not.toContain('En camino');
  });
});
