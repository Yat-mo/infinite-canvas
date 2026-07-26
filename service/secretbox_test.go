package service

import (
	"encoding/json"
	"testing"
)

func TestEncryptDecryptSecretRoundTrip(t *testing.T) {
	enc, err := EncryptSecret("super-secret-key")
	if err != nil {
		t.Fatal(err)
	}
	if enc == "super-secret-key" || enc == "" {
		t.Fatalf("expected encrypted value, got %q", enc)
	}
	plain, err := DecryptSecret(enc)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "super-secret-key" {
		t.Fatalf("got %q", plain)
	}
}

func TestSealOpenUserModelConfigJSON(t *testing.T) {
	raw := json.RawMessage(`{"apiKey":"abc","localChannels":[{"id":"1","apiKey":"xyz"}]}`)
	sealed := SealUserModelConfigJSON(raw)
	var sealedMap map[string]any
	if err := json.Unmarshal(sealed, &sealedMap); err != nil {
		t.Fatal(err)
	}
	if sealedMap["apiKey"] == "abc" {
		t.Fatal("apiKey should be encrypted")
	}
	opened := OpenUserModelConfigJSON(sealed)
	var openedMap map[string]any
	if err := json.Unmarshal(opened, &openedMap); err != nil {
		t.Fatal(err)
	}
	if openedMap["apiKey"] != "abc" {
		t.Fatalf("apiKey = %v", openedMap["apiKey"])
	}
}
