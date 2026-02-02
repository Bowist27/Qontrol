package handlers

import (
	"net/http"

	"audit-service/internal/core/domain"
	"audit-service/internal/core/services"
	"audit-service/internal/parser"

	"github.com/gin-gonic/gin"
)

// CatalogHandler handles catalog endpoints
type CatalogHandler struct {
	service *services.CatalogService
}

// NewCatalogHandler creates a new catalog handler
func NewCatalogHandler(service *services.CatalogService) *CatalogHandler {
	return &CatalogHandler{service: service}
}

// ListProducts handles GET /api/catalog
func (h *CatalogHandler) ListProducts(c *gin.Context) {
	products, err := h.service.GetAllProducts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "catalog_error",
			Message: err.Error(),
		})
		return
	}

	count, totalValue, _ := h.service.GetCatalogStats(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"products":    products,
		"total_count": count,
		"total_value": totalValue,
	})
}

// ImportCatalog handles POST /api/catalog/import
func (h *CatalogHandler) ImportCatalog(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "no_file",
			Message: "No file provided",
		})
		return
	}
	defer file.Close()

	// Parse Excel file
	products, err := parser.ParseLISTADF(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "parse_error",
			Message: err.Error(),
		})
		return
	}

	// Upsert products
	result, err := h.service.ImportProducts(c.Request.Context(), products, header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "import_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Import successful",
		"file_name":        header.Filename,
		"total_products":   result.TotalProducts,
		"new_products":     result.NewProducts,
		"updated_products": result.UpdatedProducts,
	})
}

// LookupBarcode handles GET /api/catalog/barcode/:code
func (h *CatalogHandler) LookupBarcode(c *gin.Context) {
	barcode := c.Param("code")

	product, err := h.service.FindByBarcode(c.Request.Context(), barcode)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Product not found for barcode: " + barcode,
		})
		return
	}

	c.JSON(http.StatusOK, product)
}

// RegisterRoutes sets up catalog routes
func (h *CatalogHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/catalog", h.ListProducts)
		api.POST("/catalog/import", h.ImportCatalog)
		api.GET("/catalog/barcode/:code", h.LookupBarcode)
	}
}
