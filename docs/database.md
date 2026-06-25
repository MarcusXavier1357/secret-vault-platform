# Database Documentation

The system uses **PostgreSQL** to persist secrets, versions, and audit trails. The database model is structured to maintain history integrity and prevent decryption key leakage.

---

## Entity Relationship Schema

```text
┌────────────────┐
│    secrets     │
├────────────────┤
│ id (PK)        │◄──────────┐
│ name           │           │
│ description    │           │
│ status         │           │
│ expires_at     │           │
│ current_ver_id │─────────┐ │
│ created_at     │         │ │
│ updated_at     │         │ │
└────────────────┘         │ │
        ▲                  │ │
        │                  ▼ │
        │        ┌───────────┴────┐
        │        │secret_versions │
        │        ├────────────────┤
        │        │ id (PK)        │
        └────────│ secret_id (FK) │
                 │ version        │
                 │ encrypted_value│
                 │ nonce          │
                 │ created_at     │
                 └────────────────┘
```

---

## Table Schemas

### 1. `secrets`
Represents the root metadata of a secret key.

```sql
CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(50) NOT NULL,            -- ACTIVE, REVOKED, EXPIRED
    expires_at TIMESTAMP WITH TIME ZONE,
    current_version_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `secret_versions`
Stores the actual encrypted values historically.

```sql
CREATE TABLE IF NOT EXISTS secret_versions (
    id UUID PRIMARY KEY,
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    encrypted_value TEXT NOT NULL,          -- AES-256-GCM ciphertext (base64)
    nonce TEXT NOT NULL,                    -- GCM unique nonce (base64)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_secret_version UNIQUE (secret_id, version)
);

ALTER TABLE secrets ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES secret_versions(id) ON DELETE SET NULL;
```

### 3. `audit_logs`
Saves events trails for compliance and security monitoring.

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,        -- CREATE_SECRET, READ_SECRET, etc.
    secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB                           -- Optional details (e.g. version numbers)
);
```

---

## Migrations Engine
* SQL migrations are located in `backend/migrations/`.
* The Go backend includes a self-contained migrations runner (`backend/internal/database/database.go`) executing at startup.
* Executed migrations are tracked inside the `schema_migrations` table to ensure they only run once:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
