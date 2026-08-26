from django.urls import path

from .views import CheckoutView, VerificarPagoView, WompiWebhookView

urlpatterns = [
    path("pedidos/<int:pedido_id>/checkout/", CheckoutView.as_view(), name="checkout"),
    path(
        "pedidos/<int:pedido_id>/verificar-pago/",
        VerificarPagoView.as_view(),
        name="verificar-pago",
    ),
    path("webhooks/wompi/", WompiWebhookView.as_view(), name="webhook-wompi"),
]
