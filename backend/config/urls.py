from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.common.views import SaludView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Sirve para comprobar que el stack completo responde (Angular -> proxy ->
    # Django -> Postgres). Se puede borrar cuando ya no haga falta.
    path("api/salud/", SaludView.as_view(), name="salud"),
    # Contrato entre backend y frontend: evita desincronizacion de campos.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # --- Aqui van las rutas de cada historia de usuario -------------------
    # path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.catalog.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
