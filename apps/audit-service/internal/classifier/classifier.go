package classifier

import "strings"

// AllCategories is the full list of product categories for audit filtering
var AllCategories = []string{
	"CUBETAS", "GALONES", "LITROS", "MEDIOS", "CUARTOS",
	"PORRON", "COMPLEMENTO", "AEROSOLES", "CARTUCHOS",
	"ACIDO MURIATICO", "CEPILLOS", "PLAKA", "ESPONJAS", "OTROS",
}

// ClassifyProduct returns the category for a product based on its code prefix.
// Rules are based on Comex product code conventions.
func ClassifyProduct(code string) string {
	if len(code) < 2 {
		return "OTROS"
	}

	upper := strings.ToUpper(code)

	// Letter-based prefixes (check first — more specific)
	if strings.HasPrefix(upper, "AC") {
		return "ACIDO MURIATICO"
	}
	if strings.HasPrefix(upper, "CE") {
		return "CEPILLOS"
	}
	if strings.HasPrefix(upper, "CL") {
		return "PLAKA"
	}
	if strings.HasPrefix(upper, "RT") {
		return "ESPONJAS"
	}

	// Complemento — multiple prefixes
	if strings.HasPrefix(upper, "H02") || strings.HasPrefix(upper, "RE0") ||
		strings.HasPrefix(upper, "EX0") || strings.HasPrefix(upper, "WA") {
		return "COMPLEMENTO"
	}

	// Numeric prefixes
	if strings.HasPrefix(code, "02") {
		return "CUBETAS"
	}
	if strings.HasPrefix(code, "04") {
		return "GALONES"
	}
	if strings.HasPrefix(code, "06") {
		return "LITROS"
	}
	if strings.HasPrefix(code, "07") {
		return "MEDIOS"
	}
	if strings.HasPrefix(code, "08") {
		return "CUARTOS"
	}
	if strings.HasPrefix(code, "20") {
		return "PORRON"
	}
	if strings.HasPrefix(code, "140") {
		return "AEROSOLES"
	}
	if strings.HasPrefix(code, "22") {
		return "CARTUCHOS"
	}

	return "OTROS"
}
