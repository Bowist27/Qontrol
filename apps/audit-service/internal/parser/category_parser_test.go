package parser

import "testing"

// Verifies the correction parser reads SKU -> category from a CSV with a BOM,
// an explicit header, and the category in the 3rd column (Adrián's format).
func TestParseCategoryCorrectionsCSV(t *testing.T) {
	csv := "\xEF\xBB\xBFSKU,Descripción,Categoria\n" +
		"0402510,ULTRAFACIL BLANCO 2500,GALONES\n" +
		"CL0079,RD+MIX CLASICO,PLAKA\n" +
		"H022072,CERA CUBETA,COMPLEMENTO\n" +
		",,\n" + // empty row should be skipped
		"0467922,SOLVENTE GN,PORRON\n"

	got, err := ParseCategoryCorrections([]byte(csv), "correcciones.csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := map[string]string{
		"0402510": "GALONES",
		"CL0079":  "PLAKA",
		"H022072": "COMPLEMENTO",
		"0467922": "PORRON",
	}
	if len(got) != len(want) {
		t.Fatalf("got %d rows, want %d: %v", len(got), len(want), got)
	}
	for sku, cat := range want {
		if got[sku] != cat {
			t.Errorf("sku %s = %q, want %q", sku, got[sku], cat)
		}
	}
}

// Falls back to the 3rd column when no category header is present.
func TestParseCategoryCorrectionsFallbackColumn(t *testing.T) {
	csv := "SKU,Descripción,\n" +
		"81200,INTER TOP,COMPLEMENTO\n"

	got, err := ParseCategoryCorrections([]byte(csv), "x.csv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got["81200"] != "COMPLEMENTO" {
		t.Errorf("got %q, want COMPLEMENTO", got["81200"])
	}
}
