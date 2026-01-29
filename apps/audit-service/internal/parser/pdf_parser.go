package parser

import (
	"bytes"
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
		return nil, err
	}

	var text strings.Builder
	for pageNum := 1; pageNum <= pdfReader.NumPage(); pageNum++ {
		page := pdfReader.Page(pageNum)
		if page.V.IsNull() {
			continue
		}
		content, err := page.GetPlainText(nil)
		if err != nil {
			continue
		}
		text.WriteString(content)
	}

	return p.extractItems(text.String()), nil
}

// extractItems uses regex to find product lines in the text
func (p *ComexPDFParser) extractItems(text string) []domain.AuditItem {
	var items []domain.AuditItem

	// Example regex for Comex valuation report format:
	// Artículo | Descripción | Costo | Existencia
	// 0081200 | INTER TOP ANCHO | 150.50 | 25.000

	// Pattern: product code (digits), description, cost (decimal), quantity (decimal)
	lineRegex := regexp.MustCompile(`(\d{5,10})\s+([A-Z][A-Z0-9\s\-\/]+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)`)

	matches := lineRegex.FindAllStringSubmatch(text, -1)
	for _, match := range matches {
		if len(match) >= 5 {
			cost, _ := strconv.ParseFloat(match[3], 64)
			qty, _ := strconv.ParseFloat(match[4], 64)

			item := domain.AuditItem{
				ProductCode: strings.TrimSpace(match[1]),
				ProductName: strings.TrimSpace(match[2]),
				UnitCost:    cost,
				ExpectedQty: qty,
			}
			items = append(items, item)
		}
	}

	return items
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
