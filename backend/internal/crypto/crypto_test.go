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

func TestKeyRingRotation(t *testing.T) {
	// Generate old key
	oldPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate old key: %v", err)
	}
	oldPub := &oldPriv.PublicKey

	// Generate new key
	newPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate new key: %v", err)
	}

	originalText := []byte("rotated-secret-data")

	// Encrypt using old key
	cipherText, nonce, err := EncryptWithKey(originalText, oldPub)
	if err != nil {
		t.Fatalf("EncryptWithKey failed: %v", err)
	}

	// Set package state: primary is new key, old key is in ring
	oldPrimaryPub := PublicKey
	oldPrimaryPriv := PrivateKey
	oldRing := PrivateKeyRing

	PublicKey = &newPriv.PublicKey
	PrivateKey = newPriv
	PrivateKeyRing = []*rsa.PrivateKey{oldPriv}

	// Clean up after test
	defer func() {
		PublicKey = oldPrimaryPub
		PrivateKey = oldPrimaryPriv
		PrivateKeyRing = oldRing
	}()

	// Decrypt should fallback to oldPriv in PrivateKeyRing and succeed
	decrypted, err := Decrypt(cipherText, nonce)
	if err != nil {
		t.Fatalf("Decrypt with key ring failed: %v", err)
	}

	if !bytes.Equal(originalText, decrypted) {
		t.Errorf("Expected decrypted text to match. Got %s, want %s", string(decrypted), string(originalText))
	}
}


