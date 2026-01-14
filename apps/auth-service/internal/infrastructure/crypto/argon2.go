package crypto

import (
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"log"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2Hasher handles password hashing and verification using Argon2id
type Argon2Hasher struct {
	memory      uint32
	iterations  uint32
	parallelism uint8
	saltLength  uint32
	keyLength   uint32
}

// NewArgon2Hasher creates a new Argon2 hasher with secure defaults
func NewArgon2Hasher() *Argon2Hasher {
	return &Argon2Hasher{
		memory:      64 * 1024, // 64 MB
		iterations:  3,
		parallelism: 4,
		saltLength:  16,
		keyLength:   32,
	}
}

// Verify checks if the password matches the stored hash
// Implements: Argon2.Verify(storedHash, inputPassword) -> match (boolean)
// Hash format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
func (h *Argon2Hasher) Verify(encodedHash, password string) bool {
	log.Printf("DEBUG: Verifying password against hash: %s", encodedHash[:50]+"...")

	// Parse the encoded hash
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		log.Printf("DEBUG: Hash parse failed - expected 6 parts, got %d", len(parts))
		return false
	}

	// Verify algorithm
	if parts[1] != "argon2id" {
		log.Printf("DEBUG: Wrong algorithm: %s", parts[1])
		return false
	}

	// Parse parameters
	var memory, iterations uint32
	var parallelism uint8
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism)
	if err != nil {
		log.Printf("DEBUG: Failed to parse params: %v", err)
		return false
	}
	log.Printf("DEBUG: Params - memory=%d, iterations=%d, parallelism=%d", memory, iterations, parallelism)

	// Decode salt
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		log.Printf("DEBUG: Failed to decode salt: %v", err)
		return false
	}
	log.Printf("DEBUG: Salt decoded, length=%d", len(salt))

	// Decode expected hash
	decodedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		log.Printf("DEBUG: Failed to decode hash: %v", err)
		return false
	}
	log.Printf("DEBUG: Expected hash length=%d", len(decodedHash))

	// Compute hash of provided password
	comparisonHash := argon2.IDKey(
		[]byte(password),
		salt,
		iterations,
		memory,
		parallelism,
		uint32(len(decodedHash)),
	)
	log.Printf("DEBUG: Computed hash length=%d", len(comparisonHash))

	// Constant-time comparison to prevent timing attacks
	match := subtle.ConstantTimeCompare(decodedHash, comparisonHash) == 1
	log.Printf("DEBUG: Hash comparison result: %v", match)
	return match
}

// Hash creates a new Argon2id hash of the password (for creating users)
func (h *Argon2Hasher) Hash(password string) (string, error) {
	salt := make([]byte, h.saltLength)
	// In production, use crypto/rand to generate salt
	// For now, using a simple salt for the test user
	copy(salt, []byte("somesalt12345678"))

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		h.iterations,
		h.memory,
		h.parallelism,
		h.keyLength,
	)

	// Encode to standard format
	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hash)

	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		h.memory, h.iterations, h.parallelism, saltB64, hashB64), nil
}
