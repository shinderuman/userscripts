package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Event represents the incoming API Gateway request
type Event struct {
	ASIN string `json:"asin"`
}

// KindleBook represents a book record in the S3 JSON file
type KindleBook struct {
	ASIN         string    `json:"ASIN"`
	Title        string    `json:"Title"`
	ReleaseDate  time.Time `json:"ReleaseDate"`
	CurrentPrice float64   `json:"CurrentPrice"`
	MaxPrice     float64   `json:"MaxPrice"`
	URL          string    `json:"URL"`
}

// Response represents the Lambda function response
type Response struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

// ResponseBody represents the JSON structure of the response body
type ResponseBody struct {
	Message        string `json:"message"`
	RemainingCount *int   `json:"remainingCount,omitempty"`
}

// S3FileConfig holds S3 file configuration
type S3FileConfig struct {
	BucketName string
	ObjectKey  string
}

// getS3Config retrieves S3 configuration from environment variables
func getS3Config() S3FileConfig {
	return S3FileConfig{
		BucketName: os.Getenv("S3_BUCKET_NAME"),
		ObjectKey:  os.Getenv("S3_OBJECT_KEY"),
	}
}

// readS3File reads the JSON file from S3 and parses it into KindleBook array
func readS3File(ctx context.Context, s3Client *s3.Client, config S3FileConfig) ([]KindleBook, error) {
	log.Printf("Reading S3 file: s3://%s/%s", config.BucketName, config.ObjectKey)

	// Get object from S3
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(config.BucketName),
		Key:    aws.String(config.ObjectKey),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get S3 object: %w", err)
	}
	defer result.Body.Close()

	// Read the content
	body, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read S3 object body: %w", err)
	}

	// Parse JSON
	var books []KindleBook
	if err := json.Unmarshal(body, &books); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	log.Printf("Successfully read %d books from S3", len(books))
	return books, nil
}

// removeASIN removes the specified ASIN from the books array
// Returns the updated array, whether the ASIN was found, and any error
func removeASIN(books []KindleBook, targetASIN string) ([]KindleBook, bool, error) {
	log.Printf("Searching for ASIN: %s in %d books", targetASIN, len(books))

	var updatedBooks []KindleBook
	found := false

	for _, book := range books {
		if book.ASIN == targetASIN {
			log.Printf("Found ASIN %s: %s", targetASIN, book.Title)
			found = true
			// Skip this book (effectively removing it)
			continue
		}
		updatedBooks = append(updatedBooks, book)
	}

	if !found {
		log.Printf("ASIN %s not found in the books array", targetASIN)
		return books, false, nil
	}

	log.Printf("Successfully removed ASIN %s. Books count: %d -> %d", targetASIN, len(books), len(updatedBooks))
	return updatedBooks, true, nil
}

// writeS3File writes the updated books array back to S3 as JSON
func writeS3File(ctx context.Context, s3Client *s3.Client, config S3FileConfig, books []KindleBook) error {
	log.Printf("Writing updated JSON to S3: s3://%s/%s", config.BucketName, config.ObjectKey)

	// Convert books array to JSON
	jsonData, err := json.MarshalIndent(books, "", "    ")
	if err != nil {
		return fmt.Errorf("failed to marshal books to JSON: %w", err)
	}

	// Upload to S3
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(config.BucketName),
		Key:         aws.String(config.ObjectKey),
		Body:        strings.NewReader(string(jsonData)),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return fmt.Errorf("failed to upload to S3: %w", err)
	}

	log.Printf("Successfully updated S3 file with %d books", len(books))
	return nil
}

// handler is the main Lambda function handler
func handler(ctx context.Context, event Event) (Response, error) {
	log.Printf("Processing request for ASIN: %s", event.ASIN)

	// Validate ASIN
	if event.ASIN == "" {
		return createErrorResponse(400, "ASIN is required"), nil
	}

	// Validate ASIN format (basic validation)
	if len(strings.TrimSpace(event.ASIN)) == 0 {
		return createErrorResponse(400, "Invalid ASIN format"), nil
	}

	// Get S3 configuration
	s3Config := getS3Config()
	if s3Config.BucketName == "" || s3Config.ObjectKey == "" {
		log.Printf("Missing S3 configuration: bucket=%s, key=%s", s3Config.BucketName, s3Config.ObjectKey)
		return createErrorResponse(500, "S3 configuration not found"), nil
	}

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("ap-northeast-1"))
	if err != nil {
		log.Printf("Failed to load AWS config: %v", err)
		return createErrorResponse(500, "Failed to initialize AWS configuration"), nil
	}

	// Create S3 client
	s3Client := s3.NewFromConfig(cfg)

	// Read S3 file
	books, err := readS3File(ctx, s3Client, s3Config)
	if err != nil {
		log.Printf("Failed to read S3 file: %v", err)
		return createErrorResponse(500, "Failed to read S3 file"), nil
	}

	// Remove the specified ASIN
	updatedBooks, found, err := removeASIN(books, event.ASIN)
	if err != nil {
		log.Printf("Failed to remove ASIN: %v", err)
		return createErrorResponse(500, "Failed to process ASIN removal"), nil
	}

	if !found {
		log.Printf("ASIN %s not found", event.ASIN)
		return createErrorResponse(404, "ASIN not found"), nil
	}

	// Write updated books array back to S3
	err = writeS3File(ctx, s3Client, s3Config, updatedBooks)
	if err != nil {
		log.Printf("Failed to update S3 file: %v", err)
		return createErrorResponse(500, "Failed to update S3 file"), nil
	}

	remainingCount := len(updatedBooks)
	log.Printf("Successfully processed ASIN %s removal. Remaining books: %d", event.ASIN, remainingCount)
	return createSuccessResponseWithCount(fmt.Sprintf("ASIN %s removed successfully", event.ASIN), &remainingCount), nil
}

// createSuccessResponseWithCount creates a successful HTTP response with remaining count
func createSuccessResponseWithCount(message string, remainingCount *int) Response {
	body := ResponseBody{
		Message:        message,
		RemainingCount: remainingCount,
	}
	bodyJSON, _ := json.Marshal(body)

	return Response{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		Body: string(bodyJSON),
	}
}

// createErrorResponse creates an error HTTP response
func createErrorResponse(statusCode int, message string) Response {
	body := ResponseBody{
		Message: message,
	}
	bodyJSON, _ := json.Marshal(body)

	return Response{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		Body: string(bodyJSON),
	}
}

func main() {
	lambda.Start(handler)
}
