package services

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/comex/auth-service/internal/core/domain"
)

// Custom errors for authentication
var (
	ErrInvalidCredentials = errors.New("invalid_credentials")
	ErrTooManyRequests    = errors.New("too_many_requests")
	ErrUserNotActive      = errors.New("user_not_active")
	ErrUserNotFound       = errors.New("user_not_found")
)

// UserRepository interface for database operations
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
}

// CacheClient interface for Redis operations
type CacheClient interface {
	GetAttempts(ctx context.Context, key string) (int, error)
	IncrAttempts(ctx context.Context, key string, ttl time.Duration) error
	ResetAttempts(ctx context.Context, key string) error
	SetSession(ctx context.Context, email, token string, ttl time.Duration) error
	DeleteSession(ctx context.Context, email string) error
}

// PasswordHasher interface for password verification
type PasswordHasher interface {
	Verify(hash, password string) bool
}

// TokenManager interface for JWT operations
type TokenManager interface {
	Generate(userID, email, role string) (string, error)
}

// AuthService handles authentication logic
type AuthService struct {
	userRepo      UserRepository
	cache         CacheClient
	hasher        PasswordHasher
	tokenMgr      TokenManager
	maxAttempts   int
	blockDuration time.Duration
	sessionTTL    time.Duration
}

// NewAuthService creates a new auth service instance
func NewAuthService(
	userRepo UserRepository,
	cache CacheClient,
	hasher PasswordHasher,
	tokenMgr TokenManager,
) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		cache:         cache,
		hasher:        hasher,
		tokenMgr:      tokenMgr,
		maxAttempts:   5,                // Max 5 failed attempts
		blockDuration: 15 * time.Minute, // Block for 15 minutes
		sessionTTL:    24 * time.Hour,   // Session valid for 24 hours
	}
}

// Authenticate validates user credentials and returns a token
// This implements the LoginService.Authenticate from the sequence diagram
func (s *AuthService) Authenticate(ctx context.Context, email, password, clientIP string) (*domain.LoginResponse, error) {
	attemptKey := "attempts:" + clientIP

	// Step 1: Check rate limiting (GET attempts:{ip})
	attempts, err := s.cache.GetAttempts(ctx, attemptKey)
	if err != nil {
		log.Printf("Warning: Failed to get attempts from Redis: %v", err)
		// Continue anyway, don't block login if Redis fails
	}

	// Step 2: If attempts > 5, return TooManyRequests (HTTP 429)
	if attempts >= s.maxAttempts {
		log.Printf("Rate limit exceeded for IP: %s (attempts: %d)", clientIP, attempts)
		return nil, ErrTooManyRequests
	}

	// Step 3: GetUserByEmail(email) - Query database
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// User not found - increment attempts
		log.Printf("User not found: %s", email)
		s.cache.IncrAttempts(ctx, attemptKey, s.blockDuration)
		return nil, ErrInvalidCredentials
	}

	// Step 4: Check if user is active
	if !user.IsActive {
		log.Printf("Inactive user attempted login: %s", email)
		return nil, ErrUserNotActive
	}

	// Step 5: Verify password with Argon2
	if !s.hasher.Verify(user.PasswordHash, password) {
		// Wrong password - INCR attempts:{ip}
		log.Printf("Invalid password for user: %s", email)
		s.cache.IncrAttempts(ctx, attemptKey, s.blockDuration)
		return nil, ErrInvalidCredentials
	}

	// Step 6: Password correct - DEL attempts:{ip} (Reset)
	if err := s.cache.ResetAttempts(ctx, attemptKey); err != nil {
		log.Printf("Warning: Failed to reset attempts: %v", err)
	}

	// Step 7: Generate JWT Token
	token, err := s.tokenMgr.Generate(user.ID, user.Email, user.Role)
	if err != nil {
		log.Printf("Failed to generate JWT: %v", err)
		return nil, err
	}

	// Step 8: SET session:{email} token (TTL 24h)
	if err := s.cache.SetSession(ctx, email, token, s.sessionTTL); err != nil {
		log.Printf("Warning: Failed to store session: %v", err)
	}

	log.Printf("✅ Successful login for user: %s (role: %s)", email, user.Role)

	// Return { token, user, role }
	return &domain.LoginResponse{
		Token: token,
		User:  *user,
	}, nil
}

// Logout invalidates the user session
func (s *AuthService) Logout(ctx context.Context, email string) error {
	return s.cache.DeleteSession(ctx, email)
}
