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
	ErrUserNotActive      = errors.New("user_not_active")
	ErrUserNotFound       = errors.New("user_not_found")
)

// BlockedError captures the remaining block duration
type BlockedError struct {
	Duration time.Duration
}

func (e *BlockedError) Error() string {
	return "too_many_requests"
}

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
	SetBlock(ctx context.Context, key string, duration time.Duration) error
	IsBlocked(ctx context.Context, key string) (bool, time.Duration, error)
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
		maxAttempts:   5,               // Max 5 failed attempts
		blockDuration: 3 * time.Minute, // Block for 3 minutes
		sessionTTL:    24 * time.Hour,  // Session valid for 24 hours
	}
}

// Authenticate validates user credentials and returns a token
// This implements the LoginService.Authenticate from the sequence diagram
func (s *AuthService) Authenticate(ctx context.Context, email, password, clientIP string) (*domain.LoginResponse, error) {
	attemptKey := "login_attempts:" + clientIP

	// Step 1: Check if blocked (IsBlocked)
	blocked, ttl, err := s.cache.IsBlocked(ctx, clientIP)
	if err != nil {
		log.Printf("Warning: Failed to check block status: %v", err)
	}

	if blocked {
		log.Printf("IP %s is blocked. Remaining TTL: %v", clientIP, ttl)
		return nil, &BlockedError{Duration: ttl}
	}

	// Step 2: Get current attempts (to see if we should warn/block on next fail?)
	// Actually we only care about attempts if we fail, or to check if we exceeded a hard cap?
	// But in this logic, the block is applied AFTER failure. If not blocked, we proceed.

	// Step 3: GetUserByEmail(email) - Query database
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		s.handleFailedAttempt(ctx, attemptKey, clientIP)
		return nil, ErrInvalidCredentials
	}

	// Step 4: Check if user is active
	if !user.IsActive {
		log.Printf("Inactive user attempted login: %s", email)
		return nil, ErrUserNotActive
	}

	// Step 5: Verify password with Argon2
	if !s.hasher.Verify(user.PasswordHash, password) {
		s.handleFailedAttempt(ctx, attemptKey, clientIP)
		return nil, ErrInvalidCredentials
	}

	// Step 6: Password correct - RESET everything
	if err := s.cache.ResetAttempts(ctx, attemptKey); err != nil {
		log.Printf("Warning: Failed to reset attempts: %v", err)
	}
	// Also clear any block (optional, but good practice if user waited it out)
	// We don't have Unblock method, but block key expires.

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

func (s *AuthService) handleFailedAttempt(ctx context.Context, attemptKey, clientIP string) {
	// Increment attempts with long window (e.g. 24h) to keep history
	window := 24 * time.Hour
	s.cache.IncrAttempts(ctx, attemptKey, window)

	attempts, _ := s.cache.GetAttempts(ctx, attemptKey)
	log.Printf("Failed login from %s. Attempts: %d", clientIP, attempts)

	// Calculate if block is needed
	blockDuration := s.calculateBlockDuration(attempts)
	if blockDuration > 0 {
		log.Printf("Blocking IP %s for %v (Attempts: %d)", clientIP, blockDuration, attempts)
		s.cache.SetBlock(ctx, clientIP, blockDuration)
	}
}

func (s *AuthService) calculateBlockDuration(attempts int) time.Duration {
	// Policy:
	// < 5 attempts: No block
	// 5 attempts: 1 min
	// 6 attempts: 3 min
	// 7 attempts: 5 min
	// >= 8 attempts: 15 min

	if attempts < 6 {
		return 0
	}
	if attempts == 6 {
		return 1 * time.Minute
	}
	if attempts == 7 {
		return 3 * time.Minute
	}
	if attempts == 8 {
		return 5 * time.Minute
	}
	return 15 * time.Minute
}

// Logout invalidates the user session
func (s *AuthService) Logout(ctx context.Context, email string) error {
	return s.cache.DeleteSession(ctx, email)
}
