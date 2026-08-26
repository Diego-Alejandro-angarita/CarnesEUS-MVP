import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Categoria, FiltrosCatalogo, Producto } from '../../core/models';
import { mensajeDeError } from '../../core/mensajes';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, RouterLink, PrecioCopPipe],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  private readonly catalogo = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  protected readonly auth = inject(AuthService);

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly agregando = signal<number | null>(null);
  protected readonly agregado = signal<number | null>(null);

  protected busqueda = '';
  protected categoriaSlug = '';
  protected orden = 'nombre';

  constructor() {
    void this.cargarCategorias();
    void this.buscar();
  }

  private async cargarCategorias(): Promise<void> {
    try {
      this.categorias.set(await firstValueFrom(this.catalogo.categorias()));
    } catch {
      // El catalogo funciona igual sin el filtro de categorias.
    }
  }

  protected async buscar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    const filtros: FiltrosCatalogo = {
      search: this.busqueda,
      categoria: this.categoriaSlug,
      ordering: this.orden,
    };
    try {
      const pagina = await firstValueFrom(this.catalogo.productos(filtros));
      this.productos.set(pagina.results);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar el catalogo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiarFiltros(): void {
    this.busqueda = '';
    this.categoriaSlug = '';
    this.orden = 'nombre';
    void this.buscar();
  }

  protected async agregar(producto: Producto): Promise<void> {
    this.agregando.set(producto.id);
    this.error.set('');
    try {
      // Cantidad por defecto: 1 kg o 1 unidad. En la ficha se puede ajustar.
      await this.carrito.agregar(producto.id, '1.000');
      this.agregado.set(producto.id);
      setTimeout(() => this.agregado.set(null), 2000);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo agregar al carrito.'));
    } finally {
      this.agregando.set(null);
    }
  }
}
