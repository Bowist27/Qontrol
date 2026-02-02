package parser

import (
	"bytes"
	"fmt"
	"io"
	"strconv"
	"strings"

	"audit-service/internal/core/domain"

	"github.com/xuri/excelize/v2"
)

// ParseLISTADF parses the LISTADF Excel format (Codigo, Descripcion, Unidad Venta, Codigo Barras)
func ParseLISTADF(reader io.Reader) ([]domain.Product, error) {
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	return parseExcelFile(f)
}

// ParseLISTADFFromBytes parses Excel from byte slice
func ParseLISTADFFromBytes(data []byte) ([]domain.Product, error) {
	reader := bytes.NewReader(data)
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	return parseExcelFile(f)
}

// parseExcelFile is the common parsing logic
func parseExcelFile(f *excelize.File) ([]domain.Product, error) {
	// Get the first sheet
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("failed to get rows: %w", err)
	}

	// Find header row (looking for "Codigo" in first column)
	headerRow := -1
	priceCol := -1
	for i, row := range rows {
		if len(row) > 0 {
			firstCell := strings.ToLower(strings.TrimSpace(row[0]))
			if firstCell == "codigo" || firstCell == "sku" || firstCell == "clave" {
				headerRow = i
				// Look for price column
				for j, cell := range row {
					cellLower := strings.ToLower(strings.TrimSpace(cell))
					if strings.Contains(cellLower, "precio") || strings.Contains(cellLower, "costo") || strings.Contains(cellLower, "price") {
						priceCol = j
						break
					}
				}
				break
			}
		}
	}

	if headerRow == -1 {
		return nil, fmt.Errorf("header row not found (looking for 'Codigo', 'SKU', or 'Clave')")
	}

	// Parse data rows
	var products []domain.Product
	for i := headerRow + 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) < 2 || row[0] == "" {
			continue // Skip empty rows
		}

		product := domain.Product{
			SKU:  strings.TrimSpace(row[0]),
			Name: strings.TrimSpace(row[1]),
			Unit: "pz", // Default
		}

		if len(row) > 2 && row[2] != "" {
			product.Unit = strings.TrimSpace(row[2])
		}

		if len(row) > 3 && row[3] != "" {
			product.Barcode = strings.TrimSpace(row[3])
		}

		// Try to get price if column was found
		if priceCol > 0 && priceCol < len(row) && row[priceCol] != "" {
			priceStr := strings.TrimSpace(row[priceCol])
			// Remove currency symbols and commas
			priceStr = strings.ReplaceAll(priceStr, "$", "")
			priceStr = strings.ReplaceAll(priceStr, ",", "")
			if price, err := strconv.ParseFloat(priceStr, 64); err == nil {
				product.LastPrice = price
			}
		}

		products = append(products, product)
	}

	return products, nil
}
