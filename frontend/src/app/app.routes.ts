import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'productos', pathMatch: 'full' },
  {
    path: 'productos',
    loadComponent: () => import('./features/catalogo/catalogo').then((m) => m.Catalogo),
    title: 'Catalogo | CarnesEUS',
  },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./features/ficha-producto/ficha-producto').then((m) => m.FichaProducto),
    title: 'Producto | CarnesEUS',
  },
  { path: '**', redirectTo: 'productos' },
];
