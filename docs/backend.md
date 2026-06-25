# Backend Documentation

The backend is built using **Go (Golang)** with the **Chi router** for routing and standard database/sql library for PostgreSQL interaction. It is designed around the Zero-Trust security principle.

---

## Directory Structure

```text
backend/
├── cmd/
│   └── api/
│       └── main.go           # Entrypoint: sets up router, DB connection, and starts server
├── internal/
│   ├── audit/
│   │   └── audit.go          # Event logger (records CREATE_SECRET, READ_SECRET, etc.)
│   ├── auth/
│   │   └── auth.go           # Static operator authentication (HMAC-signed cookies)
│   ├── crypto/
│   │   ├── crypto.go         # AES-256-GCM encryption/decryption utilities
│   │   └── crypto_test.go    # Unit tests for the crypto module
│   ├── database/
│   │   └── database.go       # Postgres driver setup & auto-migration runner
│   └── secrets/
│       ├── secrets.go        # Module package root initialization
│       ├── models.go         # Data transfer objects and SQL schemas structs
│       ├── helpers.go        # Name regex validation & dynamic auto-expiration logic
│       ├── crud.go           # Handlers for creating, listing, viewing, updating, revoking secrets
│       ├── versions.go       # Handlers for version listing and rollback
│       └── handlers_test.go  # Unit tests for business logic
├── migrations/               # Up migration SQL files
└── Dockerfile.dev            # Development Docker container setup
```

---

## Core Systems

### 1. Cryptography (AES-256-GCM)
* Located in `internal/crypto/crypto.go`.
* Uses **AES-256-GCM** to ensure ciphertext integrity and confidentiality.
* The 32-byte encryption key is passed via the `ENCRYPTION_KEY` environment variable.
* Output formats: Base64-encoded ciphertext and nonce.
* Plaintext is decrypted **on-demand** only when reading a single secret, never stored in plaintext or logged in history/audits.

### 2. Authentication & Sessions
* Located in `internal/auth/auth.go`.
* Operator credentials are authenticated using static environment variables (`ADMIN_USER` and `ADMIN_PASSWORD`).
* Sessions use a secure, HttpOnly, SameSite cookie containing the operator name and an HMAC-SHA256 signature to prevent tampering.
* Signature is validated against the `SESSION_SECRET` key on every request via `AuthMiddleware`.

### 3. Database & Transactions
* Located in `internal/database/database.go` and `internal/secrets/crud.go`.
* Interacts with PostgreSQL. Supports database retry logic during Docker boot sequence.
* To prevent circular dependency foreign key checks during creation and updates, transaction steps are ordered sequentially:
  1. Insert/Update data in `secrets` table first (setting `current_version_id` to NULL).
  2. Insert the version payload in `secret_versions`.
  3. Update `secrets` setting `current_version_id` to the newly created version ID.
  4. Commit transaction.
