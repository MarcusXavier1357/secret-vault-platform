package audit

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

var DB *sql.DB

func Init(db *sql.DB) {
	DB = db
}

// Log logs an event to the audit_logs table.
func Log(eventType string, secretID uuid.UUID, metadata map[string]interface{}) {
	if DB == nil {
		fmt.Printf("[AUDIT STUB] Event: %s, SecretID: %s, Metadata: %v\n", eventType, secretID, metadata)
		return
	}

	id := uuid.New()
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		fmt.Printf("Failed to marshal audit log metadata: %v\n", err)
		return
	}

	_, err = DB.Exec(
		"INSERT INTO audit_logs (id, event_type, secret_id, created_at, metadata) VALUES ($1, $2, $3, $4, $5)",
		id, eventType, secretID, time.Now(), metadataJSON,
	)
	if err != nil {
		fmt.Printf("Failed to insert audit log: %v\n", err)
	}
}

type AuditLogResponse struct {
	ID         uuid.UUID       `json:"id"`
	EventType  string          `json:"event_type"`
	SecretID   *uuid.UUID      `json:"secret_id"`
	SecretName string          `json:"secret_name"`
	CreatedAt  time.Time       `json:"created_at"`
	Metadata   json.RawMessage `json:"metadata"`
}

// ListAuditLogsHandler returns all audit logs joined with secret names
func ListAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query(`
		SELECT a.id, a.event_type, a.secret_id, COALESCE(s.name, ''), a.created_at, a.metadata
		FROM audit_logs a
		LEFT JOIN secrets s ON a.secret_id = s.id
		ORDER BY a.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	logs := []AuditLogResponse{}
	for rows.Next() {
		var l AuditLogResponse
		err := rows.Scan(&l.ID, &l.EventType, &l.SecretID, &l.SecretName, &l.CreatedAt, &l.Metadata)
		if err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		logs = append(logs, l)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(logs)
}
