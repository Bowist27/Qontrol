package services

import (
	"testing"
	"time"
)

func TestFormatSpanishDate(t *testing.T) {
	cases := map[string]struct {
		in   time.Time
		want string
	}{
		"junio":     {time.Date(2026, time.June, 15, 0, 0, 0, 0, time.UTC), "15-JUN-2026"},
		"enero":     {time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), "01-ENE-2026"},
		"diciembre": {time.Date(2025, time.December, 31, 0, 0, 0, 0, time.UTC), "31-DIC-2025"},
	}
	for name, c := range cases {
		if got := formatSpanishDate(c.in); got != c.want {
			t.Errorf("%s: formatSpanishDate = %q, quería %q", name, got, c.want)
		}
	}
}
