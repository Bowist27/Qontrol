package parser

import (
	"bytes"
	"log"
	"math"
	"regexp"
	"strconv"
	"strings"

	"audit-service/internal/core/domain"

	"github.com/ledongthuc/pdf"
)

// PDFParser extracts inventory items from PDF
type PDFParser interface {
	Parse(pdfData []byte) ([]domain.AuditItem, error)
}

// ComexPDFParser parses Comex valuation reports
type ComexPDFParser struct{}

// NewComexPDFParser creates a new parser
func NewComexPDFParser() *ComexPDFParser {
	return &ComexPDFParser{}
}

// Parse extracts items from a Comex valuation PDF
func (p *ComexPDFParser) Parse(pdfData []byte) ([]domain.AuditItem, error) {
	reader := bytes.NewReader(pdfData)
	pdfReader, err := pdf.NewReader(reader, int64(len(pdfData)))
	if err != nil {
		log.Printf("ERROR: Failed to read PDF: %v", err)
		return nil, err
	}

	var text strings.Builder
	log.Printf("DEBUG: PDF has %d pages", pdfReader.NumPage())

	for pageNum := 1; pageNum <= pdfReader.NumPage(); pageNum++ {
		page := pdfReader.Page(pageNum)
		if page.V.IsNull() {
			log.Printf("DEBUG: Page %d is null", pageNum)
			continue
		}
		content, err := page.GetPlainText(nil)
		if err != nil {
			log.Printf("DEBUG: Error reading page %d: %v", pageNum, err)
			continue
		}
		log.Printf("DEBUG: Page %d extracted %d chars", pageNum, len(content))
		text.WriteString(content)
		text.WriteString("\n") // Add newline between pages
	}

	fullText := text.String()
	log.Printf("DEBUG: Total text length: %d chars", len(fullText))

	// Log first 500 chars for debugging
	if len(fullText) > 500 {
		log.Printf("DEBUG: First 500 chars:\n%s", fullText[:500])
	} else {
		log.Printf("DEBUG: Full text:\n%s", fullText)
	}

	return p.extractItems(fullText), nil
}

// extractItems uses DATE as anchor - each date = one product row
func (p *ComexPDFParser) extractItems(text string) []domain.AuditItem {
	var items []domain.AuditItem
	var validCount, invalidCount int

	// STRATEGY: Use DATE as anchor (DD-MMM-YYYY)
	// For each date found:
	// 1. Expand context (120 chars before, 80 after)
	// 2. Extract fields from that row
	// 3. Validate: IMPORTE ≈ EXISTENCIA × COSTO_COMPRA

	dateRegex := regexp.MustCompile(`\d{2}-[A-Z]{3}-\d{4}`)
	dateMatches := dateRegex.FindAllStringIndex(text, -1)

	log.Printf("DEBUG: Found %d dates (potential rows)", len(dateMatches))

	// Regex for extracting numbers
	numWithComma := regexp.MustCompile(`[\d,]+\.\d{2}`) // Costo/Importe (.XX)
	numExistencia := regexp.MustCompile(`-?\d+\.\d{3}`) // Existencia (.XXX)
	codeRegex := regexp.MustCompile(`(\d{7}|[A-Z]\d{6}|[A-Z]{2}\d{5})`)

	for i, dateMatch := range dateMatches {
		// Expand context around the date
		start := dateMatch[0] - 120
		if start < 0 {
			start = 0
		}
		end := dateMatch[1] + 80
		if end > len(text) {
			end = len(text)
		}

		rowText := text[start:end]

		// Split row into BEFORE date and AFTER date
		dateInRow := dateMatch[0] - start
		beforeDate := rowText[:dateInRow]
		afterDate := rowText[dateInRow+11:] // 11 = len("DD-MMM-YYYY")

		// === EXTRACT FROM AFTER DATE ===
		// Pattern: EXISTENCIA(.XXX) + COSTO_COMPRA(.XX) + IMPORTE(.XX)

		existMatch := numExistencia.FindString(afterDate)
		if existMatch == "" {
			continue
		}

		// After existencia, find the next two .XX numbers
		existIdx := strings.Index(afterDate, existMatch)
		afterExist := afterDate[existIdx+len(existMatch):]
		afterNums := numWithComma.FindAllString(afterExist, 2)

		if len(afterNums) < 2 {
			continue
		}

		costoCompraStr := afterNums[0]
		importeStr := afterNums[1]

		// Parse numbers
		existencia, _ := strconv.ParseFloat(strings.ReplaceAll(existMatch, ",", ""), 64)
		costoCompra, _ := strconv.ParseFloat(strings.ReplaceAll(costoCompraStr, ",", ""), 64)
		importe, _ := strconv.ParseFloat(strings.ReplaceAll(importeStr, ",", ""), 64)

		// === MATHEMATICAL VALIDATION ===
		expectedImporte := existencia * costoCompra
		tolerance := math.Max(0.01*math.Abs(expectedImporte), 0.1)

		if math.Abs(importe-expectedImporte) > tolerance {
			invalidCount++
			continue
		}

		// === EXTRACT FROM BEFORE DATE ===
		// Pattern: CODE + DESCRIPCION + COSTO(.XX)

		costoNums := numWithComma.FindAllString(beforeDate, -1)
		if len(costoNums) == 0 {
			continue
		}
		costoStr := costoNums[len(costoNums)-1] // Last number before date is COSTO
		costo, _ := strconv.ParseFloat(strings.ReplaceAll(costoStr, ",", ""), 64)

		if costo <= 0 {
			continue
		}

		// Find CODE
		codeMatches := codeRegex.FindAllStringIndex(beforeDate, -1)
		if len(codeMatches) == 0 {
			continue
		}

		// Get the last code (closest to this row's data)
		lastCode := codeMatches[len(codeMatches)-1]
		code := beforeDate[lastCode[0]:lastCode[1]]

		// DESCRIPCION is between code and costo
		costoIdx := strings.LastIndex(beforeDate, costoStr)
		if costoIdx <= lastCode[1] {
			continue
		}

		description := strings.TrimSpace(beforeDate[lastCode[1]:costoIdx])
		if len(description) < 2 {
			continue
		}

		// Debug first few
		if i < 3 {
			log.Printf("DEBUG ROW[%d]: code=%s, desc=%s, costo=%.2f, exist=%.3f",
				i, code, description[:min(30, len(description))], costo, existencia)
		}

		// Check for duplicate
		isDuplicate := false
		for _, existing := range items {
			if existing.ProductCode == code {
				isDuplicate = true
				break
			}
		}
		if isDuplicate {
			continue
		}

		item := domain.AuditItem{
			ProductCode: code,
			ProductName: description,
			UnitCost:    costo,
			ExpectedQty: existencia,
		}
		items = append(items, item)
		validCount++
	}

	log.Printf("DEBUG: Dates=%d, Valid=%d, Invalid=%d, Extracted=%d",
		len(dateMatches), validCount, invalidCount, len(items))
	return items
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// MockPDFParser for testing without real PDFs
type MockPDFParser struct{}

// NewMockPDFParser creates a mock parser
func NewMockPDFParser() *MockPDFParser {
	return &MockPDFParser{}
}

// Parse returns dummy data for testing
func (p *MockPDFParser) Parse(pdfData []byte) ([]domain.AuditItem, error) {
	return []domain.AuditItem{
		{ProductCode: "0081200", ProductName: "INTER TOP ANCHO", UnitCost: 150.50, ExpectedQty: 25},
		{ProductCode: "0094521", ProductName: "VINIMEX TOTAL 4L", UnitCost: 890.00, ExpectedQty: 12},
		{ProductCode: "0078340", ProductName: "COMEX 100 BLANCO", UnitCost: 245.75, ExpectedQty: 8},
	}, nil
}
