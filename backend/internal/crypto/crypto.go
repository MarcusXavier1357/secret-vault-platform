package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

// Encrypt encrypts plainText using AES-256-GCM with the provided 32-byte key.
// Returns base64-encoded ciphertext and nonce.
func Encrypt(plainText []byte, key []byte) (string, string, error) {
	if len(key) != 32 {
		return "", "", fmt.Errorf("encryption key must be exactly 32 bytes (got %d)", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	cipherText := aesgcm.Seal(nil, nonce, plainText, nil)

	cipherTextBase64 := base64.StdEncoding.EncodeToString(cipherText)
	nonceBase64 := base64.StdEncoding.EncodeToString(nonce)

	return cipherTextBase64, nonceBase64, nil
}

// Decrypt decrypts the base64-encoded cipherText using the base64-encoded nonce and the 32-byte key.
func Decrypt(cipherTextBase64 string, nonceBase64 string, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("decryption key must be exactly 32 bytes")
	}

	cipherText, err := base64.StdEncoding.DecodeString(cipherTextBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	if len(nonce) != aesgcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce size")
	}

	plainText, err := aesgcm.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plainText, nil
}
