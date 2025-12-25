package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTManager handles JWT token generation and validation
type JWTManager struct {
	secretKey []byte
	expiry    time.Duration
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(secret, expiryStr string) *JWTManager {
	expiry, err := time.ParseDuration(expiryStr)
	if err != nil {
		expiry = 24 * time.Hour // Default to 24 hours
	}
	return &JWTManager{
		secretKey: []byte(secret),
		expiry:    expiry,
	}
}

// Generate creates a new JWT token for the user
// Implements: Generate JWT (Token) from sequence diagram
func (m *JWTManager) Generate(userID, email, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":   userID,                          // Subject (user ID)
		"email": email,                           // User email
		"role":  role,                            // User role (admin, user, etc.)
		"exp":   time.Now().Add(m.expiry).Unix(), // Expiration
		"iat":   time.Now().Unix(),               // Issued at
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

// Validate validates a JWT token and returns the claims
func (m *JWTManager) Validate(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return m.secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrSignatureInvalid
}
