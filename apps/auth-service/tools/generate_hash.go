//go:build ignore
// +build ignore

package main

import (
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/argon2"
)

func main() {
	// Salt fijo para pruebas: "qontrolsalt12345" (16 bytes)
	salt := []byte("qontrolsalt12345")

	type user struct {
		email    string
		password string
	}

	passwords := []user{
		{"jose.admin@gmail.com", "Admin123!"},
		{"test.user@hotmail.com", "Test1234!"},
		{"inactive@gmail.com", "Inactive123!"},
	}

	// Parameters matching our Argon2Hasher
	memory := uint32(65536) // 64 MB
	iterations := uint32(3)
	parallelism := uint8(4)
	keyLength := uint32(32) // MUST be 32 bytes

	fmt.Println("-- SQL INSERT statements with correct hashes")
	fmt.Println("-- Key length: 32 bytes")
	fmt.Println()

	for _, u := range passwords {
		hash := argon2.IDKey([]byte(u.password), salt, iterations, memory, parallelism, keyLength)

		if len(hash) != 32 {
			fmt.Printf("ERROR: Hash length is %d, expected 32\n", len(hash))
			continue
		}

		saltB64 := base64.RawStdEncoding.EncodeToString(salt)
		hashB64 := base64.RawStdEncoding.EncodeToString(hash)

		fullHash := fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
			memory, iterations, parallelism, saltB64, hashB64)

		fmt.Printf("-- Email: %s | Password: %s\n", u.email, u.password)
		fmt.Printf("'%s',\n\n", fullHash)
	}
}
