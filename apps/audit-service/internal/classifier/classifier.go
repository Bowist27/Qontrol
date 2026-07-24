package classifier

import "strings"

// AllCategories is the full list of product categories for audit filtering
var AllCategories = []string{
	"CUBETAS", "GALONES", "LITROS", "MEDIOS", "CUARTOS",
	"PORRON", "COMPLEMENTO", "AEROSOLES", "CARTUCHOS",
	"ACIDO MURIATICO", "CEPILLOS", "PLAKA", "ESPONJAS", "OTROS",
}

// validCategories is a lookup set built from AllCategories for O(1) membership checks.
var validCategories = func() map[string]struct{} {
	m := make(map[string]struct{}, len(AllCategories))
	for _, c := range AllCategories {
		m[c] = struct{}{}
	}
	return m
}()

// IsValidCategory reports whether s is one of the known product categories.
// The check is case-insensitive and tolerant of surrounding whitespace.
func IsValidCategory(s string) bool {
	_, ok := validCategories[strings.ToUpper(strings.TrimSpace(s))]
	return ok
}

// NormalizeCategory returns the canonical (upper-cased, trimmed) category if s
// matches a known category, or "" if it does not. Useful to sanitize manual /
// imported values before persisting them as the product's category.
func NormalizeCategory(s string) string {
	up := strings.ToUpper(strings.TrimSpace(s))
	if _, ok := validCategories[up]; ok {
		return up
	}
	return ""
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

	// Complemento — multiple prefixes. EX/WA match any code with that letter
	// prefix (e.g. EX00027 and EX75645 are both COMPLEMENTO).
	if strings.HasPrefix(upper, "H02") || strings.HasPrefix(upper, "RE0") ||
		strings.HasPrefix(upper, "EX") || strings.HasPrefix(upper, "WA") {
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
