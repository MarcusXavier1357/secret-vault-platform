package crypto

import (
	"bytes"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef") // 32 bytes
	originalText := []byte("my-secret-vault-password-123!")

	cipherText, nonce, err := Encrypt(originalText, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if cipherText == "" || nonce == "" {
		t.Fatalf("Expected non-empty ciphertext and nonce")
	}

	decryptedText, err := Decrypt(cipherText, nonce, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if !bytes.Equal(originalText, decryptedText) {
		t.Errorf("Expected decrypted text to match original. Got %s, want %s", string(decryptedText), string(originalText))
	}
}

func TestInvalidKeyLength(t *testing.T) {
	shortKey := []byte("short-key")
	originalText := []byte("secret")

	_, _, err := Encrypt(originalText, shortKey)
	if err == nil {
		t.Error("Expected error for short key, got nil")
	}

	_, err = Decrypt("some-ciphertext", "some-nonce", shortKey)
	if err == nil {
		t.Error("Expected error for short key in Decrypt, got nil")
	}
}

func TestTamperedCiphertext(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	originalText := []byte("secret-payload")

	cipherText, nonce, err := Encrypt(originalText, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper ciphertext
	tamperedCipherText := cipherText + "a"
	_, err = Decrypt(tamperedCipherText, nonce, key)
	if err == nil {
		t.Error("Expected decryption of tampered ciphertext to fail, but it succeeded")
	}
}
