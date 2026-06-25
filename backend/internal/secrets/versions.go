package secrets

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"secret-vault-backend/internal/audit"
)

func ListSecretVersionsHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	secretID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid secret ID format", http.StatusBadRequest)
		return
	}

	var exists bool
	err = DB.QueryRow("SELECT EXISTS(SELECT 1 FROM secrets WHERE id = $1)", secretID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, "Secret not found", http.StatusNotFound)
		return
	}

	rows, err := DB.Query(`
		SELECT id, version, created_at 
		FROM secret_versions 
		WHERE secret_id = $1 
		ORDER BY version DESC
	`, secretID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type VersionMeta struct {
		ID        uuid.UUID `json:"id"`
		Version   int       `json:"version"`
		CreatedAt time.Time `json:"created_at"`
	}

	versions := []VersionMeta{}
	for rows.Next() {
		var v VersionMeta
		err := rows.Scan(&v.ID, &v.Version, &v.CreatedAt)
		if err != nil {
			http.Error(w, "Database scan error", http.StatusInternalServerError)
			return
		}
		versions = append(versions, v)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(versions)
}

func RollbackSecretHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	secretID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid secret ID format", http.StatusBadRequest)
		return
	}

	versionStr := chi.URLParam(r, "version")
	targetVersion, err := strconv.Atoi(versionStr)
	if err != nil {
		http.Error(w, "Invalid version", http.StatusBadRequest)
		return
	}

	var secretName, currentStatus string
	var currentExpiresAt *time.Time
	var latestVersion int

	err = DB.QueryRow(`
		SELECT s.name, s.status, s.expires_at, COALESCE(v.version, 0)
		FROM secrets s
		LEFT JOIN secret_versions v ON s.current_version_id = v.id
		WHERE s.id = $1
	`, secretID).Scan(&secretName, &currentStatus, &currentExpiresAt, &latestVersion)

	if err == sql.ErrNoRows {
		http.Error(w, "Secret not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	currentStatus = checkAndUpdateExpiration(secretID, currentExpiresAt, currentStatus)

	if currentStatus == "REVOKED" {
		http.Error(w, "Revoked secrets cannot be rolled back", http.StatusUnprocessableEntity)
		return
	}

	var encryptedVal, nonce string
	err = DB.QueryRow(`
		SELECT encrypted_value, nonce 
		FROM secret_versions 
		WHERE secret_id = $1 AND version = $2
	`, secretID, targetVersion).Scan(&encryptedVal, &nonce)

	if err == sql.ErrNoRows {
		http.Error(w, "Target version not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		http.Error(w, "Transaction start failed", http.StatusInternalServerError)
		return
	}

	newVersionID := uuid.New()
	newVersionNumber := latestVersion + 1
	now := time.Now()

	status := "ACTIVE"
	if currentExpiresAt != nil && currentExpiresAt.Before(time.Now()) {
		status = "EXPIRED"
	}

	_, err = tx.Exec(`
		INSERT INTO secret_versions (id, secret_id, version, encrypted_value, nonce, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)
	`, newVersionID, secretID, newVersionNumber, encryptedVal, nonce, now)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to copy target version content", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(`
		UPDATE secrets 
		SET status = $1, current_version_id = $2, updated_at = $3
		WHERE id = $4
	`, status, newVersionID, now, secretID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update secret current version", http.StatusInternalServerError)
		return
	}

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	audit.Log("RESTORE_VERSION", secretID, map[string]interface{}{"name": secretName, "version": newVersionNumber, "restored_from": targetVersion})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{"message":"Successfully rolled back to version %d. New version is %d."}`, targetVersion, newVersionNumber)))
}
