import { Routes } from '@angular/router';

import { staffGuard } from './core/guards/staff.guard';

// Aqui van las pantallas de cada historia de usuario.
//
// Se cargan con loadComponent para que cada una llegue cuando se visita y no
// al arrancar; la wiki pide paginas por debajo de 2 segundos.
export const routes: Routes = [
  { path: '', redirectTo: 'productos', pathMatch: 'full' },
  {
    path: 'productos',
    loadComponent: () => import('./features/catalogo/catalogo').then((m) => m.Catalogo),
    title: 'Catalogo | CarnesEUS',
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/registro/registro').then((m) => m.Registro),
    title: 'Crear cuenta | CarnesEUS',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Iniciar sesion | CarnesEUS',
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./features/admin/panel/panel').then((m) => m.Panel),
    title: 'Administracion | CarnesEUS',
  },
  {
    path: 'admin/productos',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/lista-productos/lista-productos').then((m) => m.ListaProductos),
    title: 'Productos | CarnesEUS',
  },
  {
    path: 'admin/productos/nuevo',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/crear-producto/crear-producto').then((m) => m.CrearProducto),
    title: 'Crear producto | CarnesEUS',
  },
  {
    path: 'admin/productos/:id/editar',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/editar-producto/editar-producto').then((m) => m.EditarProducto),
    title: 'Modificar producto | CarnesEUS',
  },
  {
    path: 'admin/pedidos',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/pedidos/lista-pedidos/lista-pedidos').then((m) => m.ListaPedidos),
    title: 'Pedidos | CarnesEUS',
  },
  {
    path: 'admin/pedidos/:id',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/pedidos/detalle-pedido/detalle-pedido').then((m) => m.DetallePedido),
    title: 'Pedido | CarnesEUS',
  },
  {
    path: 'admin/usuarios',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/admin/usuarios/lista-usuarios/lista-usuarios').then((m) => m.ListaUsuarios),
    title: 'Usuarios | CarnesEUS',
  },
  {
    path: 'carrito',
    loadComponent: () => import('./features/carrito/carrito').then((m) => m.CarritoPagina),
    title: 'Tu carrito | CarnesEUS',
  },
    {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
    title: 'Finalizar compra | CarnesEUS',
  },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./features/ficha-producto/ficha-producto').then((m) => m.FichaProducto),
    title: 'Producto | CarnesEUS',
  },
  {
    path: 'cobertura',
    loadComponent: () => import('./features/cobertura/cobertura').then((m) => m.Cobertura),
    title: 'Zona de cobertura | CarnesEUS',
  },
  { path: '**', redirectTo: 'productos' },
];