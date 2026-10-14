import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Seccion {
  ruta: string;
  titulo: string;
  descripcion: string;
}

const SECCIONES: Seccion[] = [
  {
    ruta: '/admin/productos',
    titulo: 'Productos',
    descripcion: 'Crear, modificar, eliminar y cambiar la disponibilidad del catalogo.',
  },
  {
    ruta: '/admin/pedidos',
    titulo: 'Pedidos',
    descripcion: 'Ver los pedidos de los clientes y confirmar los que ya se pagaron.',
  },
  {
    ruta: '/admin/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Ver los clientes registrados y activar o desactivar su cuenta.',
  },
  {
    ruta: '/admin/estadisticas',
    titulo: 'Estadisticas',
    descripcion: 'Ventas, productos estrella, clientes por segmento y campañas sugeridas con IA.',
  },
];

@Component({
  selector: 'app-panel',
  imports: [RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  protected readonly secciones = SECCIONES;
}
