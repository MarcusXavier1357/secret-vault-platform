package crypto

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	originalText := []byte("my-secret-vault-password-123!")

	// Test package-level default keys (which were auto-generated)
	cipherText, nonce, err := Encrypt(originalText)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if cipherText == "" || nonce == "" {
		t.Fatalf("Expected non-empty ciphertext and nonce")
	}

	decryptedText, err := Decrypt(cipherText, nonce)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if !bytes.Equal(originalText, decryptedText) {
		t.Errorf("Expected decrypted text to match original. Got %s, want %s", string(decryptedText), string(originalText))
	}
}

func TestWithGeneratedKeys(t *testing.T) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate test RSA key: %v", err)
	}
	pubKey := &privKey.PublicKey
	originalText := []byte("another-secret")

	cipherText, nonce, err := EncryptWithKey(originalText, pubKey)
	if err != nil {
		t.Fatalf("EncryptWithKey failed: %v", err)
	}

	decryptedText, err := DecryptWithKey(cipherText, nonce, privKey)
	if err != nil {
		t.Fatalf("DecryptWithKey failed: %v", err)
	}

	if !bytes.Equal(originalText, decryptedText) {
		t.Errorf("Expected decrypted text to match. Got %s, want %s", string(decryptedText), string(originalText))
	}
}

func TestTamperedCiphertext(t *testing.T) {
	originalText := []byte("secret-payload")

	cipherText, nonce, err := Encrypt(originalText)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper ciphertext part
	tamperedCipherText := cipherText + "a"
	_, err = Decrypt(tamperedCipherText, nonce)
	if err == nil {
		t.Error("Expected decryption of tampered ciphertext to fail, but it succeeded")
	}
}

