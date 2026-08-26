from rest_framework import permissions


class EsStaff(permissions.BasePermission):
    """Solo el personal de la carniceria."""

    message = "Se requiere rol de personal de la carniceria."

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.es_staff)


class SoloLecturaOStaff(permissions.BasePermission):
    """
    Cualquiera puede leer; solo el staff escribe.

    Es el permiso del catalogo: la tienda es publica, el CRUD de productos no.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.es_staff)
