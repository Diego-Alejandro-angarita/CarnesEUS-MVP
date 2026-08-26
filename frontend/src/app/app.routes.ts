import { Routes } from '@angular/router';

import { authGuard, invitadoGuard, staffGuard } from './core/guards/auth.guard';

// Cada pantalla se carga cuando se visita, no al arrancar: la wiki pide
// paginas por debajo de 2 segundos y el catalogo es lo primero que se ve.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/catalogo/catalogo').then((m) => m.Catalogo),
    title: 'CarnesEUS | Tienda',
  },
  {
    path: 'producto/:slug',
    loadComponent: () =>
      import('./features/catalogo/producto-detalle').then((m) => m.ProductoDetalle),
    title: 'CarnesEUS | Producto',
  },
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
    title: 'CarnesEUS | Iniciar sesion',
  },
  {
    path: 'registro',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/registro').then((m) => m.Registro),
    title: 'CarnesEUS | Crear cuenta',
  },
  {
    path: 'carrito',
    canActivate: [authGuard],
    loadComponent: () => import('./features/carrito/carrito').then((m) => m.CarritoPagina),
    title: 'CarnesEUS | Carrito',
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
    title: 'CarnesEUS | Checkout',
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pedidos/pedidos').then((m) => m.Pedidos),
    title: 'CarnesEUS | Mis pedidos',
  },
  {
    path: 'pedidos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pedidos/pedido-detalle').then((m) => m.PedidoDetalle),
    title: 'CarnesEUS | Pedido',
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
    title: 'CarnesEUS | Panel',
  },
  { path: '**', redirectTo: '' },
];
