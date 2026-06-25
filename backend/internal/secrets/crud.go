package secrets

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"secret-vault-backend/internal/audit"
	"secret-vault-backend/internal/crypto"
)

func CreateSecretHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateSecretRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || !nameRegex.MatchString(req.Name) {
		http.Error(w, "Invalid secret name. Must be uppercase alphanumeric and underscores (e.g. JWT_SECRET)", http.StatusBadRequest)
		return
	}

	req.Value = strings.TrimSpace(req.Value)
	if req.Value == "" {
		http.Error(w, "Secret value cannot be empty", http.StatusBadRequest)
		return
	}

	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		http.Error(w, "Expiration date must be in the future", http.StatusBadRequest)
		return
	}

	key, err := getEncryptionKey()
	if err != nil {
		http.Error(w, "Encryption configuration error", http.StatusInternalServerError)
		return
	}

	encVal, nonce, err := crypto.Encrypt([]byte(req.Value), key)
	if err != nil {
		http.Error(w, "Failed to encrypt secret", http.StatusInternalServerError)
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	secretID := uuid.New()
	versionID := uuid.New()

	status := "ACTIVE"
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		status = "EXPIRED"
	}

	now := time.Now()

	_, err = tx.Exec(
		`INSERT INTO secrets (id, name, description, status, expires_at, current_version_id, created_at, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		secretID, req.Name, req.Description, status, req.ExpiresAt, nil, now, now,
	)
	if err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "Secret name already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create secret metadata: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`INSERT INTO secret_versions (id, secret_id, version, encrypted_value, nonce, created_at) 
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		versionID, secretID, 1, encVal, nonce, now,
	)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to store secret value", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`UPDATE secrets SET current_version_id = $1 WHERE id = $2`,
		versionID, secretID,
	)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to associate current version ID", http.StatusInternalServerError)
		return
	}

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}

	audit.Log("CREATE_SECRET", secretID, map[string]interface{}{"name": req.Name})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(SecretResponse{
		ID:          secretID,
		Name:        req.Name,
		Description: req.Description,
		Status:      status,
		Version:     1,
		ExpiresAt:   req.ExpiresAt,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
}

func ListSecretsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query(`
		SELECT s.id, s.name, s.description, s.status, s.expires_at, s.created_at, s.updated_at, v.version
		FROM secrets s
		LEFT JOIN secret_versions v ON s.current_version_id = v.id
		ORDER BY s.name ASC
	`)
	if err != nil {
		http.Error(w, "Failed to query secrets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := []SecretResponse{}
	for rows.Next() {
		var s SecretResponse
		err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt, &s.Version)
		if err != nil {
			http.Error(w, "Failed to scan row", http.StatusInternalServerError)
			return
		}

		s.Status = checkAndUpdateExpiration(s.ID, s.ExpiresAt, s.Status)

		list = append(list, s)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(list)
}

func GetSecretHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	secretID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid secret ID format", http.StatusBadRequest)
		return
	}

	var s SecretResponse
	var encryptedVal, nonce string

	err = DB.QueryRow(`
		SELECT s.id, s.name, s.description, s.status, s.expires_at, s.created_at, s.updated_at, v.version, v.encrypted_value, v.nonce
		FROM secrets s
		LEFT JOIN secret_versions v ON s.current_version_id = v.id
		WHERE s.id = $1
	`, secretID).Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt, &s.Version, &encryptedVal, &nonce)

	if err == sql.ErrNoRows {
		http.Error(w, "Secret not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	s.Status = checkAndUpdateExpiration(s.ID, s.ExpiresAt, s.Status)

	if s.Status == "ACTIVE" {
		key, err := getEncryptionKey()
		if err != nil {
			http.Error(w, "Encryption configuration error", http.StatusInternalServerError)
			return
		}

		plainBytes, err := crypto.Decrypt(encryptedVal, nonce, key)
		if err != nil {
			http.Error(w, "Failed to decrypt secret value", http.StatusInternalServerError)
			return
		}
		s.Value = string(plainBytes)
	}

	audit.Log("READ_SECRET", s.ID, map[string]interface{}{"name": s.Name})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(s)
}

func UpdateSecretHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	secretID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid secret ID format", http.StatusBadRequest)
		return
	}

	var req UpdateSecretRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	req.Value = strings.TrimSpace(req.Value)
	if req.Value == "" {
		http.Error(w, "Secret value cannot be empty", http.StatusBadRequest)
		return
	}

	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		http.Error(w, "Expiration date must be in the future", http.StatusBadRequest)
		return
	}

	var currentStatus string
	var currentExpiresAt *time.Time
	var secretName string
	var latestVersion int

	err = DB.QueryRow(`
		SELECT s.status, s.expires_at, s.name, COALESCE(v.version, 0)
		FROM secrets s
		LEFT JOIN secret_versions v ON s.current_version_id = v.id
		WHERE s.id = $1
	`, secretID).Scan(&currentStatus, &currentExpiresAt, &secretName, &latestVersion)

	if err == sql.ErrNoRows {
		http.Error(w, "Secret not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	currentStatus = checkAndUpdateExpiration(secretID, currentExpiresAt, currentStatus)

	if currentStatus == "REVOKED" {
		http.Error(w, "Revoked secrets cannot be updated", http.StatusUnprocessableEntity)
		return
	}

	key, err := getEncryptionKey()
	if err != nil {
		http.Error(w, "Encryption configuration error", http.StatusInternalServerError)
		return
	}

	encVal, nonce, err := crypto.Encrypt([]byte(req.Value), key)
	if err != nil {
		http.Error(w, "Failed to encrypt secret", http.StatusInternalServerError)
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	newVersionID := uuid.New()
	newVersionNumber := latestVersion + 1
	now := time.Now()

	status := "ACTIVE"
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		status = "EXPIRED"
	}

	_, err = tx.Exec(`
		INSERT INTO secret_versions (id, secret_id, version, encrypted_value, nonce, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)
	`, newVersionID, secretID, newVersionNumber, encVal, nonce, now)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to store new secret version", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(`
		UPDATE secrets 
		SET description = $1, status = $2, expires_at = $3, current_version_id = $4, updated_at = $5
		WHERE id = $6
	`, req.Description, status, req.ExpiresAt, newVersionID, now, secretID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update secret metadata", http.StatusInternalServerError)
		return
	}

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}

	audit.Log("UPDATE_SECRET", secretID, map[string]interface{}{"name": secretName, "version": newVersionNumber})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SecretResponse{
		ID:          secretID,
		Name:        secretName,
		Description: req.Description,
		Status:      status,
		Version:     newVersionNumber,
		ExpiresAt:   req.ExpiresAt,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
}

func RevokeSecretHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	secretID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid secret ID format", http.StatusBadRequest)
		return
	}

	var secretName string
	err = DB.QueryRow("SELECT name FROM secrets WHERE id = $1", secretID).Scan(&secretName)
	if err == sql.ErrNoRows {
		http.Error(w, "Secret not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	now := time.Now()
	_, err = DB.Exec("UPDATE secrets SET status = 'REVOKED', updated_at = $1 WHERE id = $2", now, secretID)
	if err != nil {
		http.Error(w, "Failed to revoke secret", http.StatusInternalServerError)
		return
	}

	audit.Log("REVOKE_SECRET", secretID, map[string]interface{}{"name": secretName})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"Secret successfully revoked"}`))
}
