from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel


class Pedido(TimeStampedModel):
    """
    Pedido confirmado (FR-11).

    Aqui si se congela el precio: el carrito usa el precio de hoy, el pedido el
    de cuando el cliente compro. Se puede comprar sin cuenta, por eso `usuario`
    es opcional y los datos de contacto viven en el propio pedido.
    """

    class Estado(models.TextChoices):
        POR_CONFIRMAR = "por_confirmar", "Por confirmar (transferencia)"
        POR_COBRAR = "por_cobrar", "Por cobrar (contraentrega)"
        PAGADO = "pagado", "Pagado"

    class Etapa(models.TextChoices):
        """
        En que va el pedido (FR-12), aparte de como va el pago (`estado`).

        Un pedido contraentrega se entrega antes de quedar pagado y uno por
        transferencia puede estar pagado y aun en preparacion: por eso son dos
        campos y no uno.
        """

        RECIBIDO = "recibido", "Recibido"
        EN_PREPARACION = "en_preparacion", "En preparacion"
        EN_CAMINO = "en_camino", "En camino"
        ENTREGADO = "entregado", "Entregado"
        CANCELADO = "cancelado", "Cancelado"

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="usuario",
        on_delete=models.SET_NULL,
        related_name="pedidos",
        null=True,
        blank=True,
    )
    nombre = models.CharField("nombre", max_length=120)
    email = models.EmailField("correo electronico")
    telefono = models.CharField("telefono", max_length=20)
    direccion = models.CharField("direccion", max_length=200)
    municipio = models.CharField("municipio", max_length=80)
    barrio = models.CharField("barrio", max_length=120)
    notas = models.CharField("notas para la entrega", max_length=300, blank=True)
    # FR-06: autorizacion para recibir promociones (Ley 1581 de 2012).
    acepta_comunicaciones = models.BooleanField("acepta recibir comunicaciones", default=False)
    estado = models.CharField("estado", max_length=13, choices=Estado.choices)
    etapa = models.CharField(
        "etapa", max_length=14, choices=Etapa.choices, default=Etapa.RECIBIDO
    )
    total = models.DecimalField("total", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Pedido #{self.pk} de {self.nombre}"

    def cambiar_estado(self, nuevo_estado: str) -> None:
        """
        Usado por el admin de Django y por el panel administrativo (FR-19).

        El pago sigue al pedido: pagado se refleja como aprobado, cualquier
        otro estado como pendiente. Asi un cambio hecho por error se puede
        deshacer sin dejar el pago desincronizado del pedido.
        """
        self.estado = nuevo_estado
        self.save(update_fields=["estado", "actualizado_en"])

        estado_pago = (
            Pago.Estado.APROBADO if nuevo_estado == self.Estado.PAGADO else Pago.Estado.PENDIENTE
        )
        if self.pago.estado != estado_pago:
            self.pago.estado = estado_pago
            self.pago.save(update_fields=["estado"])

    def marcar_pagado(self) -> None:
        """Atajo usado por la accion del admin de Django."""
        self.cambiar_estado(self.Estado.PAGADO)

    def etapas_siguientes(self) -> list[str]:
        """
        A que etapas puede pasar el pedido desde la actual (FR-12).

        Solo se avanza un paso a la vez y se puede cancelar mientras el pedido
        no haya salido a entrega. Entregado y cancelado son finales.
        """
        siguientes = []
        if self.etapa in SIGUIENTE_ETAPA:
            siguientes.append(SIGUIENTE_ETAPA[self.etapa])
        if self.etapa in ETAPAS_CANCELABLES:
            siguientes.append(self.Etapa.CANCELADO)
        return siguientes

    def cambiar_etapa(self, nueva_etapa: str) -> None:
        """Mueve el pedido de etapa si las reglas lo permiten y deja constancia."""
        if nueva_etapa not in self.etapas_siguientes():
            actual = self.get_etapa_display().lower()
            nueva = self.Etapa(nueva_etapa).label.lower()
            raise ValidationError(f"Un pedido {actual} no puede pasar a {nueva}.")

        with transaction.atomic():
            self.etapa = nueva_etapa
            self.save(update_fields=["etapa", "actualizado_en"])
            CambioEtapa.objects.create(pedido=self, etapa=nueva_etapa)


SIGUIENTE_ETAPA = {
    Pedido.Etapa.RECIBIDO: Pedido.Etapa.EN_PREPARACION,
    Pedido.Etapa.EN_PREPARACION: Pedido.Etapa.EN_CAMINO,
    Pedido.Etapa.EN_CAMINO: Pedido.Etapa.ENTREGADO,
}
ETAPAS_CANCELABLES = (Pedido.Etapa.RECIBIDO, Pedido.Etapa.EN_PREPARACION)


class CambioEtapa(TimeStampedModel):
    """
    Cuando paso el pedido a cada etapa, para mostrarle al cliente el
    seguimiento con fechas (FR-12). La etapa inicial no se guarda aqui: un
    pedido queda recibido cuando se crea, asi que su fecha es `creado_en`.
    """

    pedido = models.ForeignKey(
        Pedido, verbose_name="pedido", on_delete=models.CASCADE, related_name="historial"
    )
    etapa = models.CharField("etapa", max_length=14, choices=Pedido.Etapa.choices)

    class Meta:
        verbose_name = "cambio de etapa"
        verbose_name_plural = "cambios de etapa"
        ordering = ["creado_en", "id"]

    def __str__(self):
        return f"Pedido #{self.pedido_id}: {self.get_etapa_display()}"


class ItemPedido(TimeStampedModel):
    pedido = models.ForeignKey(
        Pedido, verbose_name="pedido", on_delete=models.CASCADE, related_name="items"
    )
    producto = models.ForeignKey(
        Producto,
        verbose_name="producto",
        on_delete=models.PROTECT,
        related_name="items_pedido",
    )
    # Copia del nombre y del precio al momento de comprar: si el producto cambia
    # despues, el pedido sigue diciendo lo que el cliente compro.
    nombre = models.CharField("nombre", max_length=120)
    precio_unitario = models.DecimalField("precio unitario", max_digits=10, decimal_places=2)
    cantidad = models.PositiveIntegerField("cantidad")

    class Meta:
        verbose_name = "item del pedido"
        verbose_name_plural = "items del pedido"
        ordering = ["id"]

    def __str__(self):
        return f"{self.cantidad} x {self.nombre}"

    @property
    def subtotal(self) -> Decimal:
        return self.precio_unitario * self.cantidad


class Pago(TimeStampedModel):
    """
    Como va a pagar el cliente un pedido.

    No se procesa ningun cobro en linea: la transferencia la verifica el
    personal y la contraentrega se cobra al entregar. Por eso el pago nace
    siempre "pendiente" y el personal lo marca "aprobado" desde el admin.
    """

    class Metodo(models.TextChoices):
        TRANSFERENCIA = "transferencia", "Transferencia"
        CONTRAENTREGA_QR = "contraentrega_qr", "Contraentrega con QR"
        CONTRAENTREGA_DATAFONO = "contraentrega_datafono", "Contraentrega con datafono"

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADO = "aprobado", "Aprobado"

    pedido = models.OneToOneField(
        Pedido, verbose_name="pedido", on_delete=models.CASCADE, related_name="pago"
    )
    metodo = models.CharField("metodo", max_length=22, choices=Metodo.choices)
    estado = models.CharField(
        "estado", max_length=10, choices=Estado.choices, default=Estado.PENDIENTE
    )
    monto = models.DecimalField("monto", max_digits=12, decimal_places=2)
    referencia = models.CharField(
        "referencia de la transferencia", max_length=60, blank=True
    )

    class Meta:
        verbose_name = "pago"
        verbose_name_plural = "pagos"

    def __str__(self):
        return f"{self.get_metodo_display()} - {self.get_estado_display()}"

    @property
    def es_contraentrega(self) -> bool:
        return self.metodo in METODOS_CONTRAENTREGA


METODOS_CONTRAENTREGA = (Pago.Metodo.CONTRAENTREGA_QR, Pago.Metodo.CONTRAENTREGA_DATAFONO)