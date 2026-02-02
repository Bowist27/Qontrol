package parser

import (
	"fmt"
	"io"

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
	for i, row := range rows {
		if len(row) > 0 && row[0] == "Codigo" {
			headerRow = i
			break
		}
	}

	if headerRow == -1 {
		return nil, fmt.Errorf("header row not found (looking for 'Codigo')")
	}

	// Parse data rows
	var products []domain.Product
	for i := headerRow + 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) < 2 || row[0] == "" {
			continue // Skip empty rows
		}

		product := domain.Product{
			SKU:  row[0],
			Name: row[1],
			Unit: "pz", // Default
		}

		if len(row) > 2 && row[2] != "" {
			product.Unit = row[2]
		}

		if len(row) > 3 && row[3] != "" {
			product.Barcode = row[3]
		}

		products = append(products, product)
	}

	return products, nil
}
