package storage

import (
	"bytes"
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client defines the interface for object storage
type S3Client interface {
	PutObject(ctx context.Context, key string, data []byte, contentType string) (string, error)
}

// AWSS3Client implements S3Client using AWS SDK
type AWSS3Client struct {
	client *s3.Client
	bucket string
	region string
}

// NewAWSS3Client creates a new S3 client
func NewAWSS3Client(bucket, region string) (*AWSS3Client, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &AWSS3Client{
		client: s3.NewFromConfig(cfg),
		bucket: bucket,
		region: region,
	}, nil
}

// PutObject uploads a file to S3 and returns the public URL
func (c *AWSS3Client) PutObject(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	}

	_, err := c.client.PutObject(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Return the S3 URL
	url := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", c.bucket, c.region, key)
	return url, nil
}

// MockS3Client for local development without AWS
type MockS3Client struct{}

// NewMockS3Client creates a mock client
func NewMockS3Client() *MockS3Client {
	return &MockS3Client{}
}

// PutObject simulates upload and returns a fake URL
func (c *MockS3Client) PutObject(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	return fmt.Sprintf("https://mock-bucket.s3.amazonaws.com/%s", key), nil
}
