package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"strings"

	"github.com/tigerowo/infinite-canvas/config"
)

const secretPrefix = "enc:v1:"

func secretboxKey() []byte {
	raw := strings.TrimSpace(os.Getenv("SECRETS_ENCRYPTION_KEY"))
	if raw == "" {
		raw = strings.TrimSpace(config.Cfg.JWTSecret)
	}
	if raw == "" {
		raw = "infinite-canvas"
	}
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

// EncryptSecret encrypts plaintext with AES-GCM. Empty input stays empty.
func EncryptSecret(plain string) (string, error) {
	plain = strings.TrimSpace(plain)
	if plain == "" || strings.HasPrefix(plain, secretPrefix) {
		return plain, nil
	}
	block, err := aes.NewCipher(secretboxKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	out := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return secretPrefix + base64.RawURLEncoding.EncodeToString(out), nil
}

// DecryptSecret decrypts values produced by EncryptSecret. Plain values pass through.
func DecryptSecret(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || !strings.HasPrefix(value, secretPrefix) {
		return value, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, secretPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(secretboxKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", err
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func mustEncryptSecret(plain string) string {
	enc, err := EncryptSecret(plain)
	if err != nil {
		return plain
	}
	return enc
}

func mustDecryptSecret(value string) string {
	plain, err := DecryptSecret(value)
	if err != nil {
		return value
	}
	return plain
}

// SealUserModelConfigJSON encrypts apiKey fields inside user model config JSON.
func SealUserModelConfigJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return raw
	}
	if channels, ok := payload["localChannels"].([]any); ok {
		for i := range channels {
			channel, ok := channels[i].(map[string]any)
			if !ok {
				continue
			}
			if key, ok := channel["apiKey"].(string); ok {
				channel["apiKey"] = mustEncryptSecret(key)
			}
		}
	}
	if key, ok := payload["apiKey"].(string); ok {
		payload["apiKey"] = mustEncryptSecret(key)
	}
	out, err := json.Marshal(payload)
	if err != nil {
		return raw
	}
	return out
}

// OpenUserModelConfigJSON decrypts apiKey fields inside user model config JSON.
func OpenUserModelConfigJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return raw
	}
	if channels, ok := payload["localChannels"].([]any); ok {
		for i := range channels {
			channel, ok := channels[i].(map[string]any)
			if !ok {
				continue
			}
			if key, ok := channel["apiKey"].(string); ok {
				channel["apiKey"] = mustDecryptSecret(key)
			}
		}
	}
	if key, ok := payload["apiKey"].(string); ok {
		payload["apiKey"] = mustDecryptSecret(key)
	}
	out, err := json.Marshal(payload)
	if err != nil {
		return raw
	}
	return out
}

func sealStorageProvider(provider *StorageObjectProviderInput) {
	if provider == nil {
		return
	}
	provider.SecretAccessKey = mustEncryptSecret(provider.SecretAccessKey)
}

func openStorageProvider(provider *StorageObjectProviderInput) {
	if provider == nil {
		return
	}
	provider.SecretAccessKey = mustDecryptSecret(provider.SecretAccessKey)
}
