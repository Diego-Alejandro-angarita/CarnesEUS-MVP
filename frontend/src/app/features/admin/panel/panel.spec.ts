import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Panel } from './panel';

describe('Panel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(Panel);
    fixture.detectChanges();
    return fixture;
  }

  it('enlaza a las tres secciones de administracion', () => {
    const fixture = crear();

    const enlaces = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(enlaces).toContain('/admin/productos');
    expect(enlaces).toContain('/admin/pedidos');
    expect(enlaces).toContain('/admin/usuarios');
  });
});
