package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient handles Redis operations for rate limiting and sessions
type RedisClient struct {
	client *redis.Client
}

// NewRedisClient creates a new Redis client
func NewRedisClient(addr string) *RedisClient {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "", // no password by default
		DB:       0,  // default DB
	})
	return &RedisClient{client: rdb}
}

// GetAttempts returns the number of failed login attempts for a key
// Implements: GET attempts:{ip}
func (r *RedisClient) GetAttempts(ctx context.Context, key string) (int, error) {
	val, err := r.client.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil // No attempts yet
	}
	return val, err
}

// IncrAttempts increments the failed attempt counter
// Implements: INCR attempts:{ip} with TTL
func (r *RedisClient) IncrAttempts(ctx context.Context, key string, ttl time.Duration) error {
	pipe := r.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	return err
}

// ResetAttempts deletes the attempt counter (on successful login)
// Implements: DEL attempts:{ip}
func (r *RedisClient) ResetAttempts(ctx context.Context, key string) error {
	return r.client.Del(ctx, key).Err()
}

// SetSession stores the user session token
// Implements: SET session:{email} token (TTL 24h)
func (r *RedisClient) SetSession(ctx context.Context, email, token string, ttl time.Duration) error {
	return r.client.Set(ctx, "session:"+email, token, ttl).Err()
}

// DeleteSession removes the user session (for logout)
func (r *RedisClient) DeleteSession(ctx context.Context, email string) error {
	return r.client.Del(ctx, "session:"+email).Err()
}

// GetSession retrieves a session token (for validation)
func (r *RedisClient) GetSession(ctx context.Context, email string) (string, error) {
	return r.client.Get(ctx, "session:"+email).Result()
}
