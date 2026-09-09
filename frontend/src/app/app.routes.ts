import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'productos', pathMatch: 'full' },
  {
    path: 'productos',
    loadComponent: () => import('./features/catalogo/catalogo').then((m) => m.Catalogo),
    title: 'Catalogo | CarnesEUS',
  },
  {
    path: 'admin/productos',
    loadComponent: () =>
      import('./features/admin/lista-productos/lista-productos').then((m) => m.ListaProductos),
    title: 'Productos | CarnesEUS',
  },
  {
    path: 'admin/productos/nuevo',
    loadComponent: () =>
      import('./features/admin/crear-producto/crear-producto').then((m) => m.CrearProducto),
    title: 'Crear producto | CarnesEUS',
  },
  {
    path: 'admin/productos/:id/editar',
    loadComponent: () =>
      import('./features/admin/editar-producto/editar-producto').then((m) => m.EditarProducto),
    title: 'Modificar producto | CarnesEUS',
  },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./features/ficha-producto/ficha-producto').then((m) => m.FichaProducto),
    title: 'Producto | CarnesEUS',
  },
  { path: '**', redirectTo: 'productos' },
];