# language: es
Característica: Crear producto (FR-03)
  Como personal de la carnicería
  quiero dar de alta un producto desde la administración
  para que los clientes lo vean en el catálogo

  Antecedentes:
    Dado que existe la categoría "Res"

  Escenario: Alta de un producto con datos válidos
    Cuando el administrador da de alta "Lomo fino" en "Res" a 38900 pesos
    Entonces la API responde 201
    Y el producto queda con el slug "lomo-fino"
    Y "Lomo fino" aparece en el catálogo a 38900 pesos

  Escenario: Alta rechazada por un precio en cero
    Cuando el administrador da de alta "Lomo fino" en "Res" a 0 pesos
    Entonces la API responde 400
    Y el campo "precio" informa "El precio debe ser mayor que cero."
    Y el catálogo sigue vacío
