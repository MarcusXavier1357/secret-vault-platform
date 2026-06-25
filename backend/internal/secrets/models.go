package secrets

import (
	"time"

	"github.com/google/uuid"
)

type Secret struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	Status           string     `json:"status"` // ACTIVE, REVOKED, EXPIRED
	ExpiresAt        *time.Time `json:"expires_at"`
	CurrentVersionID *uuid.UUID `json:"current_version_id"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type SecretVersion struct {
	ID             uuid.UUID `json:"id"`
	SecretID       uuid.UUID `json:"secret_id"`
	Version        int       `json:"version"`
	EncryptedValue string    `json:"encrypted_value"`
	Nonce          string    `json:"nonce"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateSecretRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Value       string     `json:"value"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

type UpdateSecretRequest struct {
	Description string     `json:"description"`
	Value       string     `json:"value"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

type SecretResponse struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Version     int        `json:"version"`
	Value       string     `json:"value,omitempty"` // Omitted in lists
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
