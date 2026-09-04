# CarnesEUS — MVP

E-commerce para carnicería: catálogo de cortes, carrito, checkout con pago en
línea y panel de gestión para el personal.

- **Backend:** Django 5.2 LTS + Django REST Framework
- **Frontend:** Angular 21
- **Base de datos:** PostgreSQL 16

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Docker Desktop | 24+ |
| Python | 3.13 |
| Node.js | 22 |

Con Docker basta para levantar todo. Python y Node solo hacen falta si prefieres
correr los servicios a mano.

---

## Arranque rápido

```bash
cp backend/.env.example backend/.env
```

```bash
docker compose up --build
```

- Aplicación: <http://localhost:4200>
- API: <http://localhost:8001/api/>
- Documentación de la API: <http://localhost:8001/api/docs/>
- Admin de Django: <http://localhost:8001/admin/>

> **Puertos:** el backend se publica en el **8001** y Postgres en el **5433**,
> no en los puertos habituales. El 8000 y el 5432 suelen estar ocupados por
> otras aplicaciones y por instalaciones locales de PostgreSQL. Dentro de
> Docker siguen siendo 8000 y 5432; solo cambia lo que se expone al host.

Para crear un usuario del admin:

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Ejecutar sin Docker

La base de datos igual hace falta:

```bash
docker compose up -d db
```

### Backend

```bash
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements/dev.txt && cp .env.example .env && python manage.py migrate && python manage.py runserver 8001
```

En Linux o macOS, `source .venv/bin/activate`.

### Frontend

```bash
cd frontend && npm install && npm start
```
