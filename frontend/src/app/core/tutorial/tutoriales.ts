export type ClaveTutorial =
  | 'cliente'
  | 'admin.bienvenida'
  | 'admin.panel'
  | 'admin.productos'
  | 'admin.producto-formulario'
  | 'admin.promociones'
  | 'admin.pedidos'
  | 'admin.pedido-detalle'
  | 'admin.usuarios'
  | 'admin.estadisticas';

export interface PasoTutorial {
  /** Valor de data-tutorial del elemento a resaltar. Sin ancla: tarjeta centrada. */
  ancla?: string;
  titulo: string;
  texto: string;
}

export const TUTORIALES: Record<ClaveTutorial, PasoTutorial[]> = {
  cliente: [
    {
      ancla: 'catalogo-busqueda',
      titulo: 'Busca un corte',
      texto: 'Busca un corte por nombre.',
    },
    {
      ancla: 'catalogo-filtros',
      titulo: 'Filtra el catalogo',
      texto: 'Filtra por categoria y precio.',
    },
    {
      ancla: 'cabecera-cobertura',
      titulo: 'Cobertura',
      texto: 'Revisa si hacemos entregas en tu barrio.',
    },
    {
      ancla: 'cabecera-carrito',
      titulo: 'Carrito',
      texto: 'Aqui ves lo que vas a comprar y finalizas el pedido.',
    },
    {
      ancla: 'cabecera-mis-pedidos',
      titulo: 'Mis pedidos',
      texto: 'Sigue el estado de tus pedidos.',
    },
  ],
  'admin.bienvenida': [
    {
      ancla: 'cabecera-administrar',
      titulo: 'Tu cuenta es de personal',
      texto:
        'Tu cuenta es de personal. Desde Administrar gestionas productos, pedidos, clientes y promociones.',
    },
  ],
  'admin.panel': [
    {
      titulo: 'Bienvenido al panel',
      texto:
        'Bienvenido al panel. Te mostramos lo basico en unos pasos; puedes saltarlo cuando quieras.',
    },
    {
      ancla: 'panel-productos',
      titulo: 'Productos',
      texto:
        'Crea, edita, elimina y marca como agotados los productos del catalogo. Las promociones estan dentro de esta seccion.',
    },
    {
      ancla: 'panel-pedidos',
      titulo: 'Pedidos',
      texto: 'Revisa los pedidos, confirma pagos y avanza cada pedido hasta entregado.',
    },
    {
      ancla: 'panel-usuarios',
      titulo: 'Usuarios',
      texto: 'Activa o desactiva las cuentas de los clientes.',
    },
    {
      ancla: 'panel-estadisticas',
      titulo: 'Estadisticas',
      texto: 'Ventas, productos mas vendidos y campanas sugeridas.',
    },
    {
      ancla: 'cabecera-administrar',
      titulo: 'Volver al panel',
      texto: 'Vuelves a este panel desde Administrar en cualquier pagina.',
    },
  ],
  'admin.productos': [
    {
      ancla: 'productos-crear',
      titulo: 'Crear producto',
      texto: 'Agrega un producto nuevo al catalogo. Aparece en la tienda apenas lo guardas.',
    },
    {
      ancla: 'productos-disponibilidad',
      titulo: 'Disponibilidad',
      texto:
        'Pulsa la etiqueta para marcar un producto como agotado. Sigue en el catalogo, marcado y al final. Se revierte con otro clic.',
    },
    {
      ancla: 'productos-acciones',
      titulo: 'Editar o eliminar',
      texto: 'Editar cambia sus datos. Eliminar pide confirmar y lo saca del catalogo.',
    },
    {
      ancla: 'productos-promociones',
      titulo: 'Promociones',
      texto: 'Aqui creas descuentos por porcentaje para uno o varios productos.',
    },
  ],
  'admin.producto-formulario': [
    {
      ancla: 'formulario-categoria',
      titulo: 'Categoria',
      texto: 'Elige la categoria: es la que usan los filtros del catalogo.',
    },
    {
      ancla: 'formulario-precio',
      titulo: 'Precio',
      texto: 'Precio por la presentacion indicada, en pesos y sin puntos.',
    },
    {
      ancla: 'formulario-opcionales',
      titulo: 'Campos opcionales',
      texto: 'Son opcionales, pero ayudan a vender: se ven en la ficha del producto.',
    },
    {
      ancla: 'formulario-guardar',
      titulo: 'Guardar',
      texto: 'Al guardar, el cambio se ve en la tienda de inmediato.',
    },
  ],
  'admin.promociones': [
    {
      ancla: 'promociones-crear',
      titulo: 'Crear promocion',
      texto: 'Crea un descuento con fechas de inicio y fin.',
    },
    {
      ancla: 'promociones-estado',
      titulo: 'Estado',
      texto:
        'Vigente se esta aplicando hoy; Programada aun no empieza; Vencida ya termino.',
    },
    {
      titulo: 'Promociones superpuestas',
      texto:
        'Si un producto esta en dos promociones a la vez, se aplica la de mayor porcentaje; no se suman.',
    },
  ],
  'admin.pedidos': [
    {
      ancla: 'pedidos-filtros',
      titulo: 'Filtros',
      texto:
        'Filtra por etapa (en que va el pedido) o por pago. Son cosas distintas: un pedido contraentrega se entrega antes de quedar pagado.',
    },
    {
      ancla: 'pedidos-ver',
      titulo: 'Ver pedido',
      texto: 'Abre el pedido para ver los datos de entrega y cambiar su etapa o su pago.',
    },
  ],
  'admin.pedido-detalle': [
    {
      ancla: 'pedido-seguimiento',
      titulo: 'Seguimiento',
      texto: 'El pedido avanza un paso a la vez: recibido, en preparacion, en camino, entregado.',
    },
    {
      ancla: 'pedido-cancelar',
      titulo: 'Cancelar',
      texto: 'Solo se cancela antes de salir a entrega, y no se puede deshacer.',
    },
    {
      ancla: 'pedido-pago',
      titulo: 'Pago',
      texto: 'Elige el estado del pago; se guarda solo, sin boton aparte.',
    },
  ],
  'admin.usuarios': [
    {
      ancla: 'usuarios-activo',
      titulo: 'Activar o desactivar',
      texto:
        'Pulsa la etiqueta para desactivar una cuenta: el cliente no podra iniciar sesion. Tu propia cuenta no se puede desactivar.',
    },
    {
      titulo: 'Permisos de personal',
      texto: 'Para dar o quitar permisos de personal se usa el admin de Django, no este panel.',
    },
  ],
  'admin.estadisticas': [
    {
      ancla: 'estadisticas-ventas',
      titulo: 'Ventas',
      texto:
        'Resumen de ventas; debajo, productos estrella y ventas por categoria, barrio y metodo de pago.',
    },
    {
      ancla: 'estadisticas-clientes',
      titulo: 'Clientes',
      texto: 'Clientes nuevos, recurrentes e inactivos (+30 dias).',
    },
    {
      ancla: 'estadisticas-ia',
      titulo: 'Sugerencias con IA',
      texto:
        'Genera ideas de campanas por segmento. Solo cuenta a los clientes que autorizaron comunicaciones.',
    },
  ],
};
