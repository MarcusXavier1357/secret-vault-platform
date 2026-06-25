package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

var (
	// PublicKey is used for encryption (writes)
	PublicKey *rsa.PublicKey
	// PrivateKey is used for decryption (reads)
	PrivateKey *rsa.PrivateKey
	// PrivateKeyRing holds legacy/rotated keys for decryption fallback
	PrivateKeyRing []*rsa.PrivateKey
)

func init() {
	// 1. Try loading keys from environment variables
	pubPem := os.Getenv("RSA_PUBLIC_KEY")
	privPem := os.Getenv("RSA_PRIVATE_KEY")
	ringPem := os.Getenv("RSA_PRIVATE_KEY_RING")

	if pubPem != "" {
		block, _ := pem.Decode([]byte(pubPem))
		if block != nil {
			pub, err := x509.ParsePKIXPublicKey(block.Bytes)
			if err == nil {
				if rsaPub, ok := pub.(*rsa.PublicKey); ok {
					PublicKey = rsaPub
				}
			}
		}
	}

	if privPem != "" {
		block, _ := pem.Decode([]byte(privPem))
		if block != nil {
			priv, err := x509.ParsePKCS8PrivateKey(block.Bytes)
			if err != nil {
				priv, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			}
			if err == nil {
				if rsaPriv, ok := priv.(*rsa.PrivateKey); ok {
					PrivateKey = rsaPriv
				}
			}
		}
	}

	if ringPem != "" {
		rest := []byte(ringPem)
		for {
			var block *pem.Block
			block, rest = pem.Decode(rest)
			if block == nil {
				break
			}
			priv, err := x509.ParsePKCS8PrivateKey(block.Bytes)
			if err != nil {
				priv, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			}
			if err == nil {
				if rsaPriv, ok := priv.(*rsa.PrivateKey); ok {
					PrivateKeyRing = append(PrivateKeyRing, rsaPriv)
				}
			}
		}
	}

	// 2. Fallback to generating keys for development/testing if none provided
	if PublicKey == nil || PrivateKey == nil {
		log.Println("WARNING: RSA keys not fully configured in env. Generating transient 2048-bit keys for dev/test.")
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			log.Fatalf("Failed to generate fallback RSA keys: %v", err)
		}
		PrivateKey = priv
		PublicKey = &priv.PublicKey
	}
}

// Encrypt encrypts plainText using Hybrid Encryption (RSA-OAEP + AES-256-GCM) with the package-level PublicKey.
func Encrypt(plainText []byte) (string, string, error) {
	if PublicKey == nil {
		return "", "", fmt.Errorf("public key not configured")
	}
	return EncryptWithKey(plainText, PublicKey)
}

// Decrypt decrypts using Hybrid Decryption (RSA-OAEP + AES-256-GCM) with the package-level PrivateKey,
// falling back to keys in PrivateKeyRing if primary decryption fails.
// If the payload format does not contain '.', it falls back to old symmetric AES-256-GCM decryption.
func Decrypt(cipherTextBase64 string, nonceBase64 string) ([]byte, error) {
	parts := strings.Split(cipherTextBase64, ".")
	if len(parts) != 2 {
		// Fallback para descriptografia simétrica antiga se ENCRYPTION_KEY estiver configurado
		oldKeyHex := os.Getenv("ENCRYPTION_KEY")
		if oldKeyHex != "" {
			var keyBytes []byte
			if len(oldKeyHex) == 32 {
				keyBytes = []byte(oldKeyHex)
			} else {
				var err error
				keyBytes, err = hex.DecodeString(oldKeyHex)
				if err != nil {
					return nil, fmt.Errorf("invalid format and failed to decode ENCRYPTION_KEY: %w", err)
				}
			}
			return decryptSymmetric(cipherTextBase64, nonceBase64, keyBytes)
		}
		return nil, fmt.Errorf("invalid encrypted value format, expected '<encDEK>.<ciphertext>'")
	}

	if PrivateKey == nil {
		return nil, fmt.Errorf("private key not configured")
	}

	// Try decrypting with primary PrivateKey first
	plainBytes, err := DecryptWithKey(cipherTextBase64, nonceBase64, PrivateKey)
	if err == nil {
		return plainBytes, nil
	}

	// Fallback to legacy keys in key ring
	for _, key := range PrivateKeyRing {
		plainBytes, err = DecryptWithKey(cipherTextBase64, nonceBase64, key)
		if err == nil {
			return plainBytes, nil
		}
	}

	return nil, fmt.Errorf("decryption failed: %w", err)
}

func decryptSymmetric(cipherTextBase64 string, nonceBase64 string, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("symmetric decryption key must be exactly 32 bytes")
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
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
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


// EncryptWithKey performs hybrid encryption:
// 1. Generates ephemeral 32-byte AES key (DEK).
// 2. Encrypts plaintext using AES-256-GCM.
// 3. Encrypts DEK using RSA-OAEP with pubKey.
// Returns base64(encryptedDEK) + "." + base64(ciphertext) and base64(nonce).
func EncryptWithKey(plainText []byte, pubKey *rsa.PublicKey) (string, string, error) {
	// 1. Generate ephemeral DEK (Data Encryption Key)
	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return "", "", fmt.Errorf("failed to generate ephemeral key: %w", err)
	}

	// 2. Encrypt payload with AES-256-GCM
	block, err := aes.NewCipher(dek)
	if err != nil {
		return "", "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := aesgcm.Seal(nil, nonce, plainText, nil)

	// 3. Encrypt DEK with RSA Public Key
	encryptedDEK, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, pubKey, dek, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to encrypt DEK with RSA: %w", err)
	}

	// 4. Format outputs
	encryptedValue := base64.StdEncoding.EncodeToString(encryptedDEK) + "." + base64.StdEncoding.EncodeToString(ciphertext)
	nonceBase64 := base64.StdEncoding.EncodeToString(nonce)

	return encryptedValue, nonceBase64, nil
}

// DecryptWithKey decrypts hybrid ciphertext:
// 1. Splits payload to extract encrypted DEK and AES ciphertext.
// 2. Decrypts DEK using RSA Private Key.
// 3. Decrypts AES ciphertext using DEK and nonce.
func DecryptWithKey(encryptedValue string, nonceBase64 string, privKey *rsa.PrivateKey) ([]byte, error) {
	parts := strings.Split(encryptedValue, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid encrypted value format, expected '<encDEK>.<ciphertext>'")
	}

	encryptedDEK, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted DEK: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}

	// 1. Decrypt DEK using RSA Private Key
	dek, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, privKey, encryptedDEK, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt DEK with RSA: %w", err)
	}

	// 2. Decrypt ciphertext using AES-256-GCM
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	if len(nonce) != aesgcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce size")
	}

	plainText, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt ciphertext: %w", err)
	}

	return plainText, nil
}
