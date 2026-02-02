package handlers

import (
	"database/sql"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	db *sql.DB
}

func NewProductHandler(db *sql.DB) *ProductHandler {
	return &ProductHandler{db: db}
}

// Product represents a product from the catalog
type Product struct {
	ID         int      `json:"id"`
	SKU        string   `json:"sku"`
	Barcode    *string  `json:"barcode"`
	Name       string   `json:"name"`
	Unit       string   `json:"unit"`
	LastPrice  *float64 `json:"last_price"`
	CreatedAt  string   `json:"created_at"`
}

// SyncProducts returns all products for offline sync
// Protected by X-Sync-Key header
func (h *ProductHandler) SyncProducts(c *gin.Context) {
	// Validate sync key
	syncKey := c.GetHeader("X-Sync-Key")
	expectedKey := os.Getenv("SYNC_SECRET_KEY")
	if expectedKey == "" {
		expectedKey = "my-secret-key-123" // Default for development
	}

	if syncKey != expectedKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid sync key"})
		return
	}

	// Query all products
	rows, err := h.db.Query(`
		SELECT id, sku, barcode, name, unit, last_price, created_at 
		FROM products 
		ORDER BY name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		err := rows.Scan(&p.ID, &p.SKU, &p.Barcode, &p.Name, &p.Unit, &p.LastPrice, &p.CreatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	c.JSON(http.StatusOK, gin.H{
		"products": products,
		"count":    len(products),
	})
}

// ListProducts returns products with optional search
func (h *ProductHandler) ListProducts(c *gin.Context) {
	search := c.Query("search")
	
	var rows *sql.Rows
	var err error
	
	if search != "" {
		pattern := "%" + search + "%"
		rows, err = h.db.Query(`
			SELECT id, sku, barcode, name, unit, last_price, created_at 
			FROM products 
			WHERE name ILIKE $1 OR sku ILIKE $1 OR barcode ILIKE $1
			ORDER BY name
			LIMIT 100
		`, pattern)
	} else {
		rows, err = h.db.Query(`
			SELECT id, sku, barcode, name, unit, last_price, created_at 
			FROM products 
			ORDER BY name
			LIMIT 100
		`)
	}
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		err := rows.Scan(&p.ID, &p.SKU, &p.Barcode, &p.Name, &p.Unit, &p.LastPrice, &p.CreatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	c.JSON(http.StatusOK, gin.H{
		"products": products,
		"count":    len(products),
	})
}
