# Infrastructure & Configuration

The application is fully containerized using **Docker** and orchestrated with **Docker Compose**, separating concern layers (Database, Backend API, Frontend SPA).

---

## Docker Compose Services

The configuration is declared in `docker-compose.yml` and structured as follows:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: secret-vault-postgres
    env_file:
      - .env
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      # Verifies PG is fully ready to accept connections before booting backend
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: secret-vault-backend
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: secret-vault-frontend
    ports:
      - "4000:4000"
    env_file:
      - .env
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
```

---

## Environment Variables Configuration

All configuration variables are stored in a single unified `.env` file at the root of the project.

| Variable | Description | Example Value |
| --- | --- | --- |
| `POSTGRES_USER` | PostgreSQL superuser username | `vault_user` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `vault_password` |
| `POSTGRES_DB` | PostgreSQL database name | `secret_vault` |
| `DB_HOST` | Database host address (inside Docker network) | `postgres` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user for backend connection | `vault_user` |
| `DB_PASSWORD` | Database password for backend connection | `vault_password` |
| `DB_NAME` | Database name for backend connection | `secret_vault` |
| `DB_SSLMODE` | Disable SSL for development database connection | `disable` |
| `PORT` | Bind port for Go API | `8080` |
| `ADMIN_USER` | Admin panel username | `admin` |
| `ADMIN_PASSWORD` | Admin panel password | `admin123` |
| `SESSION_SECRET` | Secret key for signing session HMAC-SHA256 cookies | *Random 48-byte string* |
| `ENCRYPTION_KEY` | AES-256-GCM symmetric encryption key | *Random 32-byte hex string* |
| `VITE_API_URL` | Backend URL accessed by React | `http://localhost:8080` |

---

## Booting Command Sequences

To build and start the entire stack:
```bash
docker compose up -d --build
```

To stop all running containers and networks:
```bash
docker compose down
```
