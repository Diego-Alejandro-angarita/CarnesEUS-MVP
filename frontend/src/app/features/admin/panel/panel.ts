import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { iniciarTutorialAlCargar } from '../../../core/tutorial/tutorial.service';
import { BotonTutorial } from '../../../shared/boton-tutorial/boton-tutorial';

interface Seccion {
  ruta: string;
  titulo: string;
  descripcion: string;
  tutorial: string;
}

const SECCIONES: Seccion[] = [
  {
    ruta: '/admin/productos',
    titulo: 'Productos',
    descripcion: 'Crear, modificar, eliminar y cambiar la disponibilidad del catalogo.',
    tutorial: 'panel-productos',
  },
  {
    ruta: '/admin/pedidos',
    titulo: 'Pedidos',
    descripcion: 'Ver los pedidos de los clientes y confirmar los que ya se pagaron.',
    tutorial: 'panel-pedidos',
  },
  {
    ruta: '/admin/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Ver los clientes registrados y activar o desactivar su cuenta.',
    tutorial: 'panel-usuarios',
  },
  {
    ruta: '/admin/estadisticas',
    titulo: 'Estadisticas',
    descripcion: 'Ventas, productos estrella, clientes por segmento y campañas sugeridas con IA.',
    tutorial: 'panel-estadisticas',
  },
];

@Component({
  selector: 'app-panel',
  imports: [RouterLink, BotonTutorial],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  protected readonly secciones = SECCIONES;

  constructor() {
    iniciarTutorialAlCargar('admin.panel');
  }
}
