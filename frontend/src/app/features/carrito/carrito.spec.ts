import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CarritoPagina } from './carrito';

const CARRITO_CON_UN_ITEM = {
  token: 'token-de-prueba',
  items: [
    {
      id: 7,
      producto_id: 1,
      nombre: 'Lomo fino',
      slug: 'lomo-fino',
      presentacion: 'Bandeja 500 g',
      foto_url: '',
      precio: '38900.00',
      cantidad: 2,
      comprable: true,
      subtotal: '77800.00',
    },
  ],
  cantidad_items: 2,
  total: '77800.00',
};

const CARRITO_VACIO = { token: 'token-de-prueba', items: [], cantidad_items: 0, total: '0.00' };

describe('CarritoPagina', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CarritoPagina],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra las lineas y el total que devuelve la API', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/carrito/').flush(CARRITO_CON_UN_ITEM);
    await fixture.whenStable();

    const componente = fixture.componentInstance;
    expect(componente['items']().length).toBe(1);
    expect(componente['items']()[0].subtotal).toBe(77800);
    expect(componente['total']()).toBe(77800);
  });

  it('guarda el token para volver al mismo carrito', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/carrito/').flush(CARRITO_CON_UN_ITEM);
    await fixture.whenStable();

    expect(localStorage.getItem('carneseus.carrito.token')).toBe('token-de-prueba');
  });

  it('cambiar la cantidad pide un PATCH y actualiza el total', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/carrito/').flush(CARRITO_CON_UN_ITEM);
    await fixture.whenStable();

    void fixture.componentInstance['cambiar'](7, 3);

    const peticion = http.expectOne('/api/carrito/items/7/');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ cantidad: 3 });
    peticion.flush({
      ...CARRITO_CON_UN_ITEM,
      items: [{ ...CARRITO_CON_UN_ITEM.items[0], cantidad: 3, subtotal: '116700.00' }],
      cantidad_items: 3,
      total: '116700.00',
    });
    await fixture.whenStable();

    expect(fixture.componentInstance['total']()).toBe(116700);
  });

  it('no deja bajar la cantidad por debajo de uno', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/carrito/').flush(CARRITO_CON_UN_ITEM);
    await fixture.whenStable();

    void fixture.componentInstance['cambiar'](7, 0);

    http.expectNone('/api/carrito/items/7/');
  });

  it('quitar pide un DELETE y deja el carrito vacio', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/carrito/').flush(CARRITO_CON_UN_ITEM);
    await fixture.whenStable();

    void fixture.componentInstance['quitar'](7);

    const peticion = http.expectOne('/api/carrito/items/7/');
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(CARRITO_VACIO);
    await fixture.whenStable();

    expect(fixture.componentInstance['items']().length).toBe(0);
    expect(fixture.componentInstance['total']()).toBe(0);
  });

  it('avisa cuando la API falla', async () => {
    const fixture = TestBed.createComponent(CarritoPagina);
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/carrito/').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(fixture.componentInstance['estado']()).toBe('error');
  });
});