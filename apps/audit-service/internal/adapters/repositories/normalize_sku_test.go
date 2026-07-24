package repositories

import "testing"

// Verifica que el escaneo encuentre el producto sin importar el prefijo "19A":
// normalizeSKU debe producir tanto la forma con prefijo como sin él.
func TestNormalizeSKUVariants(t *testing.T) {
	contains := func(s []string, v string) bool {
		for _, x := range s {
			if x == v {
				return true
			}
		}
		return false
	}

	// Código escaneado SIN prefijo -> debe ofrecer también la variante CON prefijo
	got := normalizeSKU("WA02007")
	if !contains(got, "WA02007") || !contains(got, "19AWA02007") {
		t.Errorf("normalizeSKU(WA02007) = %v, faltan variantes esperadas", got)
	}

	// Código de valuación CON prefijo -> debe ofrecer también la variante SIN prefijo
	got = normalizeSKU("19AWA02007")
	if !contains(got, "19AWA02007") || !contains(got, "WA02007") {
		t.Errorf("normalizeSKU(19AWA02007) = %v, faltan variantes esperadas", got)
	}
}
