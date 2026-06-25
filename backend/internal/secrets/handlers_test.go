package secrets

import (
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
