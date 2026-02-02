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
		text.WriteString(content)
		text.WriteString("\n")
	}

	fullText := text.String()
	// Clean non-printable chars
	fullText = strings.ReplaceAll(fullText, "\x00", "")
	log.Printf("DEBUG: Total text length: %d chars", len(fullText))
	return p.extractItems(fullText), nil
}

// extractItems uses a math-based brute force parsing strategy
func (p *ComexPDFParser) extractItems(text string) []domain.AuditItem {
	var items []domain.AuditItem
	var validCount int

	// STRATEGY: Global Pre-processing to prevent false Anchors

	// 1. Separate stuck Importe from Code (e.g. ".960200300" -> ".96 0200300")
	importeCodeSplitter := regexp.MustCompile(`(\.\d{2})(\d{7}|[A-Z]\d{6}|[A-Z]{2}\d{5})`)
	text = importeCodeSplitter.ReplaceAllString(text, "$1 $2")

	// 2. Separate stuck money decimals from following numbers (e.g. "20.9916" -> "20.99 16")
	// Refined: Only split if followed by something looking like a Day (00-39).
	// This protects 3-decimal quantities where 3rd digit is often >= 0 (but 0.105 -> 5X NOT Day).
	stuckMoneyFixer := regexp.MustCompile(`(\.\d{2})([0-3][0-9])`)
	text = stuckMoneyFixer.ReplaceAllString(text, "$1 $2")

	// 3. Separate words from numbers, protecting single and 2-letter codes (e.g. "NYLON20" -> "NYLON 20", "LF00807" safe)
	multiLetterAlphaNum := regexp.MustCompile(`([A-Z]{3,})([0-9])`)
	text = multiLetterAlphaNum.ReplaceAllString(text, "$1 $2")

	// 4. Remove Dates GLOBALLY to prevent years (e.g. 2025...) being detected as fake Product Codes
	// Improved Date Regex: allow spaces, optional parts handling
	dateRegex := regexp.MustCompile(`(\d{1,2})\s?[-/]\s?([A-Z]{3})\s?[-/]\s?(\d{2,4})`)
	text = dateRegex.ReplaceAllString(text, "           ")

	// Now find anchors on clean text
	codeRegex := regexp.MustCompile(`(?:^|[^\d])(\d{7}|[A-Z]\d{6}|[A-Z]{2}\d{5})`)
	codeMatches := codeRegex.FindAllStringSubmatchIndex(text, -1)
	log.Printf("DEBUG: Found %d potential product codes", len(codeMatches))

	// Catches blocks of stuck numbers. Strict digits/dots/commas/minus/slash/quote.
	// We include / and " so that fractions "1/2" or dims "2" are captured as blocks,
	// causing ParseFloat to FAIL, thus removing them from the stream.
	dirtyBlockRegex := regexp.MustCompile(`-?[0-9.,/"']+|[0-9.,]+`)

	for i, match := range codeMatches {
		codeStart := match[2]
		codeEnd := match[3]
		code := text[codeStart:codeEnd]

		var nextCodeStart int = len(text)
		if i+1 < len(codeMatches) {
			nextCodeStart = codeMatches[i+1][2]
		}

		rowEnd := nextCodeStart
		if rowEnd-codeEnd > 600 {
			rowEnd = codeEnd + 600
		}

		// Text is already clean globally
		cleanRow := text[codeEnd:rowEnd]

		// Find dirty blocks of numbers
		blocks := dirtyBlockRegex.FindAllString(cleanRow, -1)

		var streamA []float64 // 2-dec split
		var streamB []float64 // 3-dec split

		for _, block := range blocks {
			streamA = append(streamA, splitByDecimals(block, 2)...)
			streamB = append(streamB, splitByDecimals(block, 3)...)
		}

		var found bool

		// Check Stream A
		if item := findItemInStream(streamA, code, cleanRow); item != nil {
			checkAndAdd(item, &items, &validCount)
			found = true
			if i < 5 {
				log.Printf("DEBUG SUCCESS[A]: Code=%s Qty=%.3f Cost=%.2f", code, item.ExpectedQty, item.UnitCost)
			}
		} else if item := findItemInStream(streamB, code, cleanRow); item != nil {
			// Check Stream B
			checkAndAdd(item, &items, &validCount)
			found = true
			if i < 5 {
				log.Printf("DEBUG SUCCESS[B]: Code=%s Qty=%.3f Cost=%.2f", code, item.ExpectedQty, item.UnitCost)
			}
		}

		if !found {
			log.Printf("DEBUG INVALID: Code=%s StreamA=%v StreamB=%v RawRow='%s' NextCodeStart=%d", code, streamA, streamB, strings.ReplaceAll(cleanRow, "\n", " "), nextCodeStart)
		}

		// DEBUG SPY for RE00001 issue (Legacy) and 0262133 (New issue)
		if code == "RE00002" || code == "0262133" {
			log.Printf("DEBUG SPY %s: Context: '%s'", code, text[max(0, codeStart-200):min(len(text), codeEnd+200)])
		}
	}

	log.Printf("DEBUG: Codes=%d, Valid=%d, Total=%d", len(codeMatches), validCount, len(items))
	return items
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func checkAndAdd(item *domain.AuditItem, items *[]domain.AuditItem, count *int) {
	for _, ex := range *items {
		if ex.ProductCode == item.ProductCode {
			return
		}
	}
	*items = append(*items, *item)
	*count++
}

func findItemInStream(nums []float64, code string, context string) *domain.AuditItem {
	if len(nums) < 2 {
		return nil
	}

	for j := 0; j < len(nums)-1; j++ {
		// Try Pair A*B approx C?
		// We verify triplet A, B, C (A*B=C)
		if j+2 < len(nums) {
			A := nums[j]
			B := nums[j+1]
			C := nums[j+2]

			if validateMath(A, B, C) {
				// Matched A * B = C.

				// Priority:
				// 1. Decimals vs Integer Heuristic (Cost normally looks like money)
				// 2. Sandwich Heuristic (Price repetition)
				// 3. Size Heuristic (fallback)

				hasDecA := hasSignificantDecimals(A)
				hasDecB := hasSignificantDecimals(B)

				var qty, cost float64

				if hasDecA && !hasDecB {
					// A is Cost, B is Qty
					cost = A
					qty = B
				} else if !hasDecA && hasDecB {
					// A is Qty, B is Cost
					qty = A
					cost = B
				} else {
					// Both ambiguous. Try Sandwich.
					isSandwich := false
					if j > 0 {
						prev := nums[j-1]
						if validateEquality(prev, B) {
							isSandwich = true
						}
					}

					if isSandwich {
						qty = A
						cost = B
					} else {
						// Fallback: Assume Qty is smaller unless A > B
						if A < B {
							qty = A
							cost = B
						} else {
							qty = B
							cost = A
						}
					}
				}

				if code == "0279401" {
					log.Printf("DEBUG 0279401 RESOLVED: A=%f B=%f Qty=%f Cost=%f", A, B, qty, cost)
				}

				return createItem(code, cost, qty, context)
			}
		}
	}
	return nil
}

func hasSignificantDecimals(f float64) bool {
	return math.Abs(f-math.Round(f)) > 0.001
}

func validateEquality(a, b float64) bool {
	return math.Abs(a-b) < 0.01
}

func createItem(code string, cost float64, qty float64, context string) *domain.AuditItem {
	costStr := strconv.FormatFloat(cost, 'f', 2, 64)
	contextClean := strings.ReplaceAll(context, ",", "")
	idx := strings.Index(contextClean, costStr)
	desc := "Producto " + code
	if idx > 0 {
		rawDesc := contextClean[:idx]
		rawDesc = strings.TrimSpace(rawDesc)
		rawDesc = strings.ReplaceAll(rawDesc, "\n", " ")
		rawDesc = strings.Join(strings.Fields(rawDesc), " ")
		// Corrected: REMOVED digits from TrimRight to support names like "V1", "5X1"
		rawDesc = strings.TrimRight(rawDesc, ".- ")
		if len(rawDesc) > 2 {
			desc = rawDesc
		}
	}
	return &domain.AuditItem{
		ProductCode: code,
		ProductName: desc,
		UnitCost:    cost,
		ExpectedQty: qty,
	}
}

func validateMath(a, b, c float64) bool {
	expected := a * b
	// Allow zero results (e.g. Cost * 0Qty = 0Total)
	if expected == 0 {
		return math.Abs(c) < 0.01
	}
	tolerance := math.Max(0.05*math.Abs(expected), 0.5)
	return math.Abs(c-expected) <= tolerance
}

func splitByDecimals(block string, decimals int) []float64 {
	var nums []float64
	current := block
	step := decimals + 1

	for {
		if len(current) == 0 {
			break
		}
		dot := strings.Index(current, ".")
		if dot == -1 {
			// No dot means integer or garbage.
			if f, err := strconv.ParseFloat(strings.ReplaceAll(current, ",", ""), 64); err == nil {
				nums = append(nums, f)
			}
			break
		}

		endIdx := dot + step
		if endIdx <= len(current) {
			valStr := current[:endIdx]
			if f, err := strconv.ParseFloat(strings.ReplaceAll(valStr, ",", ""), 64); err == nil {
				nums = append(nums, f)
				current = current[endIdx:]
				continue
			}
		} else {
			// Fallback: Try parsing the rest as a number
			if f, err := strconv.ParseFloat(strings.ReplaceAll(current, ",", ""), 64); err == nil {
				nums = append(nums, f)
			}
			break
		}

		if len(current) > 0 {
			current = current[1:]
		}
	}
	return nums
}

type MockPDFParser struct{}

func NewMockPDFParser() *MockPDFParser { return &MockPDFParser{} }
func (p *MockPDFParser) Parse(pdfData []byte) ([]domain.AuditItem, error) {
	return []domain.AuditItem{}, nil
}
