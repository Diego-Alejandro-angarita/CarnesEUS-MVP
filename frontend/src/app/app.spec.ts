import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('se construye', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra la marca enlazada al catalogo', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const marca = (fixture.nativeElement as HTMLElement).querySelector('.cabecera__marca');
    expect(marca?.textContent).toContain('CarnesEUS');
    expect(marca?.getAttribute('href')).toBe('/productos');
  });
});
