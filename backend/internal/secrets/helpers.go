package secrets

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"
)

var nameRegex = regexp.MustCompile(`^[A-Z0-9_]+$`)

func checkAndUpdateExpiration(id uuid.UUID, expiresAt *time.Time, currentStatus string) string {
	if currentStatus == "REVOKED" {
		return "REVOKED"
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		if currentStatus != "EXPIRED" {
			if DB != nil {
				_, err := DB.Exec("UPDATE secrets SET status = 'EXPIRED', updated_at = $1 WHERE id = $2", time.Now(), id)
				if err != nil {
					fmt.Printf("Failed to auto-expire secret %s: %v\n", id, err)
				}
			}
		}
		return "EXPIRED"
	}
	return currentStatus
}

func sendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
