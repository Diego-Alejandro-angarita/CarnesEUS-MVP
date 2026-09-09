import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api():
    """Cliente HTTP para las pruebas de la API."""
    return APIClient()
