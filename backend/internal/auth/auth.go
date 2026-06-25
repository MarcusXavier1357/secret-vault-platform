package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func getSessionSecret() []byte {
	secret := os.Getenv("SESSION_SECRET")
	if len(secret) < 32 {
		return []byte("fallback-super-secret-hmac-key-for-session-signing-32b")
	}
	return []byte(secret)
}

func generateSignature(value string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func createSignedSession(username string) string {
	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	payload := fmt.Sprintf("%s:%d", username, expiresAt)
	signature := generateSignature(payload, getSessionSecret())
	return fmt.Sprintf("%s:%s", payload, signature)
}

func verifySignedSession(sessionVal string) (string, error) {
	parts := strings.Split(sessionVal, ":")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid session format")
	}

	username := parts[0]
	expiresStr := parts[1]
	signature := parts[2]

	payload := fmt.Sprintf("%s:%s", username, expiresStr)
	expectedSignature := generateSignature(payload, getSessionSecret())

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return "", fmt.Errorf("invalid signature")
	}

	var expiresAt int64
	_, err := fmt.Sscanf(expiresStr, "%d", &expiresAt)
	if err != nil {
		return "", fmt.Errorf("invalid expiry")
	}

	if time.Now().Unix() > expiresAt {
		return "", fmt.Errorf("session expired")
	}

	return username, nil
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var creds Credentials
	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	adminUser := os.Getenv("ADMIN_USER")
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminUser == "" || adminPass == "" {
		adminUser = "admin"
		adminPass = "senha_forte"
	}

	if creds.Username != adminUser || creds.Password != adminPass {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sessionToken := createSignedSession(creds.Username)

	// Use secure, httponly cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    sessionToken,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   false, // Set to true in prod
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"message":"Login successful"}`))
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"message":"Logged out"}`))
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		username, err := verifySignedSession(cookie.Value)
		if err != nil {
			http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}

		// Sessão válida, prossegue
		r.Header.Set("X-User", username)
		next.ServeHTTP(w, r)
	})
}

func CheckSessionHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	username, err := verifySignedSession(cookie.Value)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"username": username})
}
