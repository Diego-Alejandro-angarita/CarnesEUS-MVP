import { Routes } from '@angular/router';

// Aqui van las pantallas de cada historia de usuario.
//
// Se cargan con loadComponent para que cada una llegue cuando se visita y no
// al arrancar; la wiki pide paginas por debajo de 2 segundos. Ejemplo:
//
//   {
//     path: 'productos',
//     loadComponent: () =>
//       import('./features/catalogo/catalogo').then((m) => m.Catalogo),
//     title: 'Catalogo',
//   },
export const routes: Routes = [];
