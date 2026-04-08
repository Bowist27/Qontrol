package parser

import (
	"fmt"
	"strings"
	"testing"
)

// TestDescriptionParsing verifies that product descriptions are extracted cleanly
// without numeric garbage from cost/qty/total columns.
func TestDescriptionParsing(t *testing.T) {
	p := NewComexPDFParser()

	// Simulate realistic Comex PDF text with an extra column (Min=0) between qty and total.
	// This replicates the bug where "INTER TOP (ANCHO 1.10 CON 100 MT633.98 2.00 0"
	// was being captured as the description.
	//
	// Columns: Code | Description | Costo | Existencia | Min | Total | PrecioPublico
	simulatedText := strings.Join([]string{
		"VALUACION DE INVENTARIO",
		"Tienda: 5 De Mayo",
		"0951299 INTER TOP (ANCHO 1.10 CON 100 MT) 633.98 2.00 0 1,267.96 1,064.00",
		"0200300 PRO 1000 PLUS BLANCO 1425.42 29.00 0 41,337.18 2,819.00",
		"0089528 PRO 1000 PLUS ROJO OXIDO 1514.17 2.00 0 3,028.34 2,819.00",
		"0262133 VINIMEX ROJO CARDENAL 1516.25 1.00 0 1,516.25 3,684.00",
		"RE01399 REAL FLEX BLANCO 1741.03 1.00 0 1,741.03 1,179.00",
		"0201400 DUREX MASTER BLANCO 963.23 20.00 0 19,264.60 1,796.00",
	}, "\n")

	items := p.extractItems(simulatedText)

	fmt.Println("\n=== RESULTADOS DEL PARSER ===")
	fmt.Printf("Total items parseados: %d\n\n", len(items))

	for _, item := range items {
		fmt.Printf("SKU: %-10s | Costo: $%10.2f | Qty: %5.2f | Desc: %s\n",
			item.ProductCode, item.UnitCost, item.ExpectedQty, item.ProductName)
	}
	fmt.Println()

	// Verify specific items
	tests := []struct {
		code         string
		wantCost     float64
		wantQty      float64
		descContains string    // Description MUST contain this
		descExcludes []string  // Description must NOT contain these
	}{
		{
			code:         "0951299",
			wantCost:     633.98,
			wantQty:      2.00,
			descContains: "INTER TOP",
			descExcludes: []string{"633.98", "2.00", "1267", "1064"},
		},
		{
			code:         "0200300",
			wantCost:     1425.42,
			wantQty:      29.00,
			descContains: "PRO 1000 PLUS BLANCO",
			descExcludes: []string{"1425.42", "29.00", "41337"},
		},
		{
			code:         "0089528",
			wantCost:     1514.17,
			wantQty:      2.00,
			descContains: "PRO 1000 PLUS ROJO OXIDO",
			descExcludes: []string{"1514.17", "3028"},
		},
		{
			code:         "0201400",
			wantCost:     963.23,
			wantQty:      20.00,
			descContains: "DUREX MASTER BLANCO",
			descExcludes: []string{"963.23", "19264"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.code, func(t *testing.T) {
			var found bool
			for _, item := range items {
				if item.ProductCode == tc.code {
					found = true

					// Check cost
					if item.UnitCost != tc.wantCost {
						t.Errorf("Cost = %.2f, want %.2f", item.UnitCost, tc.wantCost)
					}

					// Check qty
					if item.ExpectedQty != tc.wantQty {
						t.Errorf("Qty = %.2f, want %.2f", item.ExpectedQty, tc.wantQty)
					}

					// Check description contains expected text
					if !strings.Contains(item.ProductName, tc.descContains) {
						t.Errorf("Description %q should contain %q", item.ProductName, tc.descContains)
					}

					// Check description does NOT contain numeric garbage
					for _, exc := range tc.descExcludes {
						if strings.Contains(item.ProductName, exc) {
							t.Errorf("Description %q should NOT contain %q", item.ProductName, exc)
						}
					}

					break
				}
			}
			if !found {
				t.Errorf("Product %s not found in parsed items", tc.code)
			}
		})
	}
}
