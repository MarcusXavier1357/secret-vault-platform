package secrets

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"time"

	"github.com/google/uuid"
)

var nameRegex = regexp.MustCompile(`^[A-Z0-9_]+$`)

func getEncryptionKey() ([]byte, error) {
	keyHex := os.Getenv("ENCRYPTION_KEY")
	if len(keyHex) == 32 {
		return []byte(keyHex), nil
	}
	keyBytes, err := hex.DecodeString(keyHex)
	if err != nil || len(keyBytes) != 32 {
		return []byte("0123456789abcdef0123456789abcdef"), nil
	}
	return keyBytes, nil
}

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
