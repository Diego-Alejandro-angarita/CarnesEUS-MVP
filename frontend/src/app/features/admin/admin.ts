import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/mensajes';
import { Categoria, EstadoPedido, Pedido, Producto } from '../../core/models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

type Pestana = 'pedidos' | 'productos';

const PRODUCTO_VACIO = {
  nombre: '',
  slug: '',
  descripcion: '',
  categoria: null as number | null,
  precio: '',
  unidad_medida: 'KG' as const,
  stock: '',
};

@Component({
  selector: 'app-admin',
  imports: [DatePipe, FormsModule, PrecioCopPipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  private readonly catalogo = inject(CatalogoService);
  private readonly pedidosService = inject(PedidosService);

  protected readonly pestana = signal<Pestana>('pedidos');

  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly ocupado = signal<string | null>(null);

  /** Estados que el mostrador puede fijar. PAGADO lo decide la pasarela. */
  protected readonly estadosGestionables: EstadoPedido[] = [
    'EN_PREPARACION',
    'ENVIADO',
    'ENTREGADO',
    'CANCELADO',
  ];

  protected nuevo = { ...PRODUCTO_VACIO };
  protected mostrarFormulario = false;

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [pedidos, productos, categorias] = await Promise.all([
        firstValueFrom(this.pedidosService.lista()),
        firstValueFrom(this.catalogo.productos({ ordering: 'nombre' })),
        firstValueFrom(this.catalogo.categorias()),
      ]);
      this.pedidos.set(pedidos.results);
      this.productos.set(productos.results);
      this.categorias.set(categorias);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar el panel.'));
    } finally {
      this.cargando.set(false);
    }
  }

  // --- Pedidos (FR-12) ---------------------------------------------------

  protected async cambiarEstado(pedido: Pedido, estado: string): Promise<void> {
    await this.ejecutar(`pedido-${pedido.id}`, async () => {
      const actualizado = await firstValueFrom(
        this.pedidosService.cambiarEstado(pedido.id, estado as EstadoPedido),
      );
      this.pedidos.update((lista) =>
        lista.map((p) => (p.id === actualizado.id ? actualizado : p)),
      );
    });
  }

  // --- Productos (FR-03/04/05/09) ---------------------------------------

  protected async cambiarDisponibilidad(producto: Producto): Promise<void> {
    await this.ejecutar(`producto-${producto.id}`, async () => {
      const actualizado = await firstValueFrom(
        this.catalogo.cambiarDisponibilidad(producto.slug, !producto.disponible),
      );
      this.productos.update((lista) =>
        lista.map((p) => (p.id === actualizado.id ? actualizado : p)),
      );
    });
  }

  protected async crearProducto(): Promise<void> {
    await this.ejecutar('nuevo-producto', async () => {
      const creado = await firstValueFrom(
        this.catalogo.crear({
          ...this.nuevo,
          // El slug se deriva del nombre para no pedirselo al mostrador.
          slug: this.nuevo.slug || this.aSlug(this.nuevo.nombre),
          categoria: this.nuevo.categoria!,
        } as Partial<Producto>),
      );
      this.productos.update((lista) => [...lista, creado]);
      this.nuevo = { ...PRODUCTO_VACIO };
      this.mostrarFormulario = false;
    });
  }

  protected async eliminarProducto(producto: Producto): Promise<void> {
    if (!confirm(`¿Eliminar "${producto.nombre}" del catalogo?`)) {
      return;
    }
    await this.ejecutar(`producto-${producto.id}`, async () => {
      await firstValueFrom(this.catalogo.eliminar(producto.slug));
      this.productos.update((lista) => lista.filter((p) => p.id !== producto.id));
    });
  }

  private aSlug(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ejecutar(clave: string, accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(clave);
    this.error.set('');
    try {
      await accion();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo completar la accion.'));
    } finally {
      this.ocupado.set(null);
    }
  }
}
