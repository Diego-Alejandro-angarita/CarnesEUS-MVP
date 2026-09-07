import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'productos', pathMatch: 'full' },
  {
    path: 'productos',
    loadComponent: () => import('./features/catalogo/catalogo').then((m) => m.Catalogo),
    title: 'Catalogo | CarnesEUS',
  },
  {
    path: 'admin/productos/nuevo',
    loadComponent: () =>
      import('./features/admin/crear-producto/crear-producto').then((m) => m.CrearProducto),
    title: 'Crear producto | CarnesEUS',
  },
  { path: '**', redirectTo: 'productos' },
];
