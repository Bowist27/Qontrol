package parser

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

// ParseCategoryCorrections reads a SKU -> category mapping from a correction
// file (Adrián's Excel, or a CSV). It expects a header row containing a SKU/
// código column and a category column. The category column is detected by
// header keywords (categoria / unidad / presentacion / tipo); if none is found
// it falls back to the 3rd column, then the last column.
//
// Returns a map keyed by trimmed SKU. Categories are returned as-is (raw) so the
// caller can validate/normalize them against the known category set.
func ParseCategoryCorrections(data []byte, fileName string) (map[string]string, error) {
	var rows [][]string
	var err error

	if isExcel(fileName) {
		rows, err = readExcelRows(data)
	} else {
		rows, err = readCSVRows(data)
	}
	if err != nil {
		return nil, err
	}
	return rowsToCategoryMap(rows)
}

func isExcel(fileName string) bool {
	lower := strings.ToLower(fileName)
	return strings.HasSuffix(lower, ".xlsx") || strings.HasSuffix(lower, ".xls")
}

func readExcelRows(data []byte) ([][]string, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}
	return f.GetRows(sheets[0])
}

func readCSVRows(data []byte) ([][]string, error) {
	// Strip UTF-8 BOM if present (Excel-exported CSVs often start with it).
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	r := csv.NewReader(bytes.NewReader(data))
	r.FieldsPerRecord = -1 // tolerate ragged rows
	var rows [][]string
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read CSV: %w", err)
		}
		rows = append(rows, rec)
	}
	return rows, nil
}

func rowsToCategoryMap(rows [][]string) (map[string]string, error) {
	headerRow := -1
	catCol := -1
	skuCol := 0

	for i, row := range rows {
		for j, cell := range row {
			c := strings.ToLower(strings.TrimSpace(cell))
			if c == "sku" || c == "codigo" || c == "código" || c == "clave" {
				headerRow = i
				skuCol = j
			}
			if strings.Contains(c, "categor") || c == "unidad" ||
				strings.Contains(c, "presentac") || c == "tipo" || c == "articulo" || c == "artículo" {
				catCol = j
			}
		}
		if headerRow == i {
			break
		}
	}

	if headerRow == -1 {
		return nil, fmt.Errorf("no se encontró la fila de encabezado (se busca 'SKU', 'Codigo' o 'Clave')")
	}

	// Fallback for the category column: 3rd column, else last column.
	if catCol == -1 {
		sample := rows[headerRow]
		if len(sample) > 2 {
			catCol = 2
		} else if len(sample) > 0 {
			catCol = len(sample) - 1
		} else {
			return nil, fmt.Errorf("no se pudo determinar la columna de categoría")
		}
	}

	result := make(map[string]string)
	for i := headerRow + 1; i < len(rows); i++ {
		row := rows[i]
		if skuCol >= len(row) || catCol >= len(row) {
			continue
		}
		sku := strings.TrimSpace(row[skuCol])
		cat := strings.TrimSpace(row[catCol])
		if sku == "" || cat == "" {
			continue
		}
		result[sku] = cat
	}
	return result, nil
}
