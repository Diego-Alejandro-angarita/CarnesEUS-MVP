import { Routes } from '@angular/router';

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