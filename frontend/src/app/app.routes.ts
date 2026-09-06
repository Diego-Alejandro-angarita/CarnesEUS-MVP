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
    loadComponent: () =>
      import('./features/registro/registro').then((m) => m.Registro),
    title: 'Crear cuenta',
  },
  { path: '**', redirectTo: 'productos' },
];
