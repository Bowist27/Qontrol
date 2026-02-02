package handlers

import (
	"io"
	"net/http"
	"strconv"

	"audit-service/internal/core/domain"
	"audit-service/internal/core/services"
	"audit-service/internal/parser"

	"github.com/gin-gonic/gin"
)

// CatalogHandler handles catalog endpoints
type CatalogHandler struct {
	service   *services.CatalogService
	pdfParser parser.PDFParser
}

// NewCatalogHandler creates a new catalog handler
func NewCatalogHandler(service *services.CatalogService, pdfParser parser.PDFParser) *CatalogHandler {
	return &CatalogHandler{
		service:   service,
		pdfParser: pdfParser,
	}
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

// AnalyzeReport handles POST /api/catalog/analyze
// Parses a valuation report (PDF/Excel) and compares against the current catalog
func (h *CatalogHandler) AnalyzeReport(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "no_file",
			Message: "No file provided",
		})
		return
	}
	defer file.Close()

	storeName := c.PostForm("store_name")
	if storeName == "" {
		storeName = "Tienda Desconocida"
	}

	// Read file contents
	fileData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read file",
		})
		return
	}

	// Parse based on file type
	var items []domain.AuditItem
	fileName := header.Filename

	if isExcelFile(fileName) {
		// Parse Excel (LISTADF format with prices)
		products, err := parser.ParseLISTADFFromBytes(fileData)
		if err != nil {
			c.JSON(http.StatusBadRequest, domain.ErrorResponse{
				Error:   "parse_error",
				Message: err.Error(),
			})
			return
		}
		// Convert products to audit items
		for _, p := range products {
			items = append(items, domain.AuditItem{
				ProductCode: p.SKU,
				ProductName: p.Name,
				UnitCost:    p.LastPrice,
			})
		}
	} else {
		// Parse PDF
		items, err = h.pdfParser.Parse(fileData)
		if err != nil {
			c.JSON(http.StatusBadRequest, domain.ErrorResponse{
				Error:   "parse_error",
				Message: err.Error(),
			})
			return
		}
	}

	// Analyze against current catalog
	result, err := h.service.AnalyzeValuationReport(c.Request.Context(), items, fileName, storeName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "analyze_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SaveAnalysis handles POST /api/catalog/analyze/save
// Saves an analyzed report for later commit
func (h *CatalogHandler) SaveAnalysis(c *gin.Context) {
	var req struct {
		Result   domain.CatalogDiffResult `json:"result"`
		UserName string                   `json:"user_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	importID, err := h.service.SaveImport(c.Request.Context(), &req.Result, req.UserName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "save_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Analysis saved",
		"import_id": importID,
	})
}

// CommitImport handles POST /api/catalog/imports/:id/commit
// Applies selected changes to the catalog
func (h *CatalogHandler) CommitImport(c *gin.Context) {
	idStr := c.Param("id")
	importID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid import ID",
		})
		return
	}

	var req struct {
		SelectedSKUs []string `json:"selected_skus"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	err = h.service.CommitImport(c.Request.Context(), importID, req.SelectedSKUs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "commit_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Changes applied successfully",
		"import_id":    importID,
		"applied_skus": len(req.SelectedSKUs),
	})
}

// RevertImport handles POST /api/catalog/imports/:id/revert
// Reverts an applied import
func (h *CatalogHandler) RevertImport(c *gin.Context) {
	idStr := c.Param("id")
	importID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid import ID",
		})
		return
	}

	err = h.service.RevertImport(c.Request.Context(), importID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "revert_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Import reverted successfully",
		"import_id": importID,
	})
}

// DiscardImport handles DELETE /api/catalog/imports/:id
// Deletes a pending import without applying it
func (h *CatalogHandler) DiscardImport(c *gin.Context) {
	importID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid import ID",
		})
		return
	}

	err = h.service.DiscardImport(c.Request.Context(), importID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "discard_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Import discarded successfully",
		"import_id": importID,
	})
}

// RestoreImport handles POST /api/catalog/imports/:id/restore
// Restores a previous version as the current active version
func (h *CatalogHandler) RestoreImport(c *gin.Context) {
	importID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid import ID",
		})
		return
	}

	err = h.service.RestoreImport(c.Request.Context(), importID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "restore_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Version restored successfully",
		"import_id": importID,
	})
}

// GetImportHistory handles GET /api/catalog/imports
func (h *CatalogHandler) GetImportHistory(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	history, err := h.service.GetImportHistory(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "history_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"imports": history,
	})
}

// RegisterRoutes sets up catalog routes
func (h *CatalogHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/catalog", h.ListProducts)
		api.POST("/catalog/import", h.ImportCatalog)
		api.GET("/catalog/barcode/:code", h.LookupBarcode)
		
		// New endpoints for diff engine
		api.POST("/catalog/analyze", h.AnalyzeReport)
		api.POST("/catalog/analyze/save", h.SaveAnalysis)
		api.GET("/catalog/imports", h.GetImportHistory)
		api.GET("/catalog/valuation/latest", h.GetLatestValuation)
		api.POST("/catalog/imports/:id/commit", h.CommitImport)
		api.POST("/catalog/imports/:id/revert", h.RevertImport)
		api.POST("/catalog/imports/:id/restore", h.RestoreImport)
		api.DELETE("/catalog/imports/:id", h.DiscardImport)
	}
}

// GetLatestValuation handles GET /api/catalog/valuation/latest
// Returns the latest pending valuation import with its products
func (h *CatalogHandler) GetLatestValuation(c *gin.Context) {
	imp, items, err := h.service.GetLatestPendingValuation(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "No pending valuation found",
		})
		return
	}

	// Build summary
	summary := gin.H{
		"id":                  imp.ID,
		"file_name":           imp.FileName,
		"store_name":          imp.StoreName,
		"imported_by":         imp.ImportedByName,
		"new_products":        imp.NewProducts,
		"price_up":            imp.PriceUpCount,
		"price_down":          imp.PriceDownCount,
		"unchanged":           imp.UnchangedCount,
		"total_value":         imp.TotalValue,
		"previous_value":      imp.PreviousValue,
		"economic_impact_up":   imp.EconomicImpactUp,
		"economic_impact_down": imp.EconomicImpactDown,
		"status":              imp.Status,
		"created_at":          imp.CreatedAt,
	}

	// Build products list
	products := make([]gin.H, 0, len(items))
	for _, item := range items {
		p := gin.H{
			"sku":         item.SKU,
			"name":        item.ProductName,
			"change_type": item.ChangeType,
			"new_price":   item.NewPrice,
			"difference":  item.Difference,
			"selected":    item.Selected,
		}
		if item.OldPrice != nil {
			p["old_price"] = *item.OldPrice
		}
		if item.PercentChange != nil {
			p["percent_change"] = *item.PercentChange
		}
		products = append(products, p)
	}

	c.JSON(http.StatusOK, gin.H{
		"summary":  summary,
		"products": products,
	})
}

// isExcelFile checks if the file is an Excel file
func isExcelFile(fileName string) bool {
	return len(fileName) > 5 && (fileName[len(fileName)-5:] == ".xlsx" || fileName[len(fileName)-4:] == ".xls")
}
