package secrets

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNameValidation(t *testing.T) {
	validNames := []string{
		"JWT_SECRET",
		"AWS_ACCESS_KEY_ID",
		"DB_PASSWORD",
		"API_KEY_123",
	}

	invalidNames := []string{
		"jwt-secret",
		"DB PASSWORD",
		"api_key",
		"",
		"@",
	}

	for _, name := range validNames {
		if !nameRegex.MatchString(name) {
			t.Errorf("Expected name %q to be valid", name)
		}
	}

	for _, name := range invalidNames {
		if nameRegex.MatchString(name) {
			t.Errorf("Expected name %q to be invalid", name)
		}
	}
}

func TestCheckAndUpdateExpiration(t *testing.T) {
	id := uuid.New()

	// 1. Revoked status should stay revoked
	if status := checkAndUpdateExpiration(id, nil, "REVOKED"); status != "REVOKED" {
		t.Errorf("Expected status to remain REVOKED, got %s", status)
	}

	// 2. Future expiration should remain ACTIVE
	future := time.Now().Add(10 * time.Hour)
	if status := checkAndUpdateExpiration(id, &future, "ACTIVE"); status != "ACTIVE" {
		t.Errorf("Expected status to remain ACTIVE, got %s", status)
	}

	// 3. Past expiration should transition to EXPIRED (database test skipped here, but status checks)
	past := time.Now().Add(-10 * time.Hour)
	// Even if DB is nil (will print print log), the returned status from helper must be EXPIRED
	if status := checkAndUpdateExpiration(id, &past, "ACTIVE"); status != "EXPIRED" {
		t.Errorf("Expected status to become EXPIRED, got %s", status)
	}
}

func TestCreateSecretPayloadValidation(t *testing.T) {
	t.Run("Invalid JSON Payload", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/api/secrets", bytes.NewBuffer([]byte("{invalid-json")))
		rr := httptest.NewRecorder()
		CreateSecretHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rr.Code)
		}

		var resp map[string]string
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["error"] != "Invalid request payload" {
			t.Errorf("expected error 'Invalid request payload', got '%s'", resp["error"])
		}
	})

	t.Run("Invalid Name Format", func(t *testing.T) {
		payload, _ := json.Marshal(CreateSecretRequest{
			Name:  "invalid-name",
			Value: "my-secret",
		})
		req, _ := http.NewRequest("POST", "/api/secrets", bytes.NewBuffer(payload))
		rr := httptest.NewRecorder()
		CreateSecretHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rr.Code)
		}

		var resp map[string]string
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if !strings.Contains(resp["error"], "Must be uppercase alphanumeric") {
			t.Errorf("expected validation message, got '%s'", resp["error"])
		}
	})

	t.Run("Empty Value", func(t *testing.T) {
		payload, _ := json.Marshal(CreateSecretRequest{
			Name:  "VALID_NAME",
			Value: "",
		})
		req, _ := http.NewRequest("POST", "/api/secrets", bytes.NewBuffer(payload))
		rr := httptest.NewRecorder()
		CreateSecretHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rr.Code)
		}

		var resp map[string]string
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["error"] != "Secret value cannot be empty" {
			t.Errorf("expected error 'Secret value cannot be empty', got '%s'", resp["error"])
		}
	})

	t.Run("Expiration In Past", func(t *testing.T) {
		pastDate := time.Now().Add(-10 * time.Minute)
		payload, _ := json.Marshal(CreateSecretRequest{
			Name:      "VALID_NAME",
			Value:     "secret-value",
			ExpiresAt: &pastDate,
		})
		req, _ := http.NewRequest("POST", "/api/secrets", bytes.NewBuffer(payload))
		rr := httptest.NewRecorder()
		CreateSecretHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rr.Code)
		}

		var resp map[string]string
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["error"] != "Expiration date must be in the future" {
			t.Errorf("expected error 'Expiration date must be in the future', got '%s'", resp["error"])
		}
	})
}

