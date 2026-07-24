package handlers

import (
	"io"
	"net/http"
	"strconv"

	"audit-service/internal/adapters/middleware"
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
	// Parse query parameters for pagination
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "25")
	search := c.Query("search")
	sortBy := c.Query("sort_by") // "price_asc" or "price_desc"
	hideZero := c.Query("hide_zero") == "true"

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 25
	}

	products, totalCount, err := h.service.GetProductsPaginated(c.Request.Context(), page, limit, search, sortBy, hideZero)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "catalog_error",
			Message: err.Error(),
		})
		return
	}

	_, totalValue, _ := h.service.GetCatalogStats(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"products":    products,
		"total_count": totalCount,
		"total_value": totalValue,
		"page":        page,
		"limit":       limit,
	})
}

// UpdateProduct handles PUT /api/catalog/products/:id
func (h *CatalogHandler) UpdateProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid product ID",
		})
		return
	}

	var req struct {
		SKU     string  `json:"sku"`
		Name    string  `json:"name"`
		Barcode string  `json:"barcode"`
		Unit    string  `json:"unit"`
		Price   float64 `json:"price"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	// Get user info from context (set by auth middleware)
	userEmail, _ := c.Get("user_email")
	userName, _ := c.Get("user_name")
	email := "Sistema"
	name := "Sistema"
	if e, ok := userEmail.(string); ok && e != "" {
		email = e
	}
	if n, ok := userName.(string); ok && n != "" {
		name = n
	}

	if err := h.service.UpdateProduct(c.Request.Context(), id, req.SKU, req.Name, req.Barcode, req.Unit, req.Price, email, name); err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "update_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product updated successfully",
	})
}

// DeleteProduct handles DELETE /api/catalog/products/:id
func (h *CatalogHandler) DeleteProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid product ID",
		})
		return
	}

	// Get user info from context (set by auth middleware)
	userEmail, _ := c.Get("user_email")
	userName, _ := c.Get("user_name")
	email := "Sistema"
	name := "Sistema"
	if e, ok := userEmail.(string); ok && e != "" {
		email = e
	}
	if n, ok := userName.(string); ok && n != "" {
		name = n
	}

	if err := h.service.DeleteProduct(c.Request.Context(), id, email, name); err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "delete_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product deleted successfully",
	})
}

// CreateProduct handles POST /api/catalog/products
func (h *CatalogHandler) CreateProduct(c *gin.Context) {
	var req struct {
		SKU     string  `json:"sku"`
		Name    string  `json:"name"`
		Barcode string  `json:"barcode"`
		Unit    string  `json:"unit"`
		Price   float64 `json:"price"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	// Get user info from context (set by auth middleware)
	userEmail, _ := c.Get("user_email")
	userName, _ := c.Get("user_name")
	email := "Sistema"
	name := "Sistema"
	if e, ok := userEmail.(string); ok && e != "" {
		email = e
	}
	if n, ok := userName.(string); ok && n != "" {
		name = n
	}

	product := &domain.Product{
		SKU:       req.SKU,
		Name:      req.Name,
		Barcode:   req.Barcode,
		Unit:      req.Unit,
		LastPrice: req.Price,
	}

	id, err := h.service.CreateProduct(c.Request.Context(), product, email, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "create_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Product created successfully",
		"product_id": id,
	})
}

// GetProductChanges handles GET /api/catalog/changes
func (h *CatalogHandler) GetProductChanges(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 200 {
		limit = 50
	}

	changes, err := h.service.GetProductChanges(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"changes":     changes,
		"total_count": len(changes),
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

// ImportCategories handles POST /api/catalog/categories/import
// Reads a SKU -> category correction file (Adrián's Excel / CSV) and updates
// each product's category (stored in the unit column). Bulk override on top of
// the prefix classifier — only the exceptions need to be in the file.
func (h *CatalogHandler) ImportCategories(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "no_file",
			Message: "No file provided",
		})
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read file",
		})
		return
	}

	corrections, err := parser.ParseCategoryCorrections(fileData, header.Filename)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "parse_error",
			Message: err.Error(),
		})
		return
	}

	result, err := h.service.ImportCategoryCorrections(c.Request.Context(), corrections)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "import_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Categorías importadas",
		"file_name":   header.Filename,
		"total_rows":  len(corrections),
		"updated":     result.Updated,
		"not_found":   result.NotFound,
		"invalid":     result.Invalid,
		"skipped_skus": result.Skipped,
	})
}

// DetectUpload handles POST /api/catalog/detect-upload
// Inspects the uploaded file and reports whether it is a category-correction
// list or a valuation/catalog file, so the single "Actualizar Catálogo" button
// can route automatically without extra buttons.
func (h *CatalogHandler) DetectUpload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "no_file",
			Message: "No file provided",
		})
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read file",
		})
		return
	}

	kind := h.service.DetectUploadKind(fileData, header.Filename)
	c.JSON(http.StatusOK, gin.H{"kind": kind})
}

// ReclassifyCategories handles POST /api/catalog/reclassify
// Backfills every product's category (unit column) from the prefix classifier.
func (h *CatalogHandler) ReclassifyCategories(c *gin.Context) {
	updated, err := h.service.ReclassifyCatalogUnits(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "reclassify_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Catálogo reclasificado por prefijo",
		"updated": updated,
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

// RegisterRoutes sets up catalog routes (legacy - unprotected)
func (h *CatalogHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/catalog", h.ListProducts)
		api.POST("/catalog/products", h.CreateProduct)
		api.PUT("/catalog/products/:id", h.UpdateProduct)
		api.DELETE("/catalog/products/:id", h.DeleteProduct)
		api.POST("/catalog/import", h.ImportCatalog)
		api.POST("/catalog/categories/import", h.ImportCategories)
		api.POST("/catalog/detect-upload", h.DetectUpload)
		api.POST("/catalog/reclassify", h.ReclassifyCategories)
		api.DELETE("/catalog/clear", h.ClearCatalog)
		api.GET("/catalog/barcode/:code", h.LookupBarcode)
		api.GET("/catalog/changes", h.GetProductChanges)

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

// RegisterRoutesWithAuth sets up catalog routes with authentication middleware
func (h *CatalogHandler) RegisterRoutesWithAuth(router *gin.Engine, auth *middleware.AuthMiddleware) {
	api := router.Group("/api")
	api.Use(auth.RequireAuth())
	{
		api.GET("/catalog", h.ListProducts)
		api.POST("/catalog/products", h.CreateProduct)
		api.PUT("/catalog/products/:id", h.UpdateProduct)
		api.DELETE("/catalog/products/:id", h.DeleteProduct)
		api.POST("/catalog/import", h.ImportCatalog)
		api.POST("/catalog/categories/import", h.ImportCategories)
		api.POST("/catalog/detect-upload", h.DetectUpload)
		api.POST("/catalog/reclassify", h.ReclassifyCategories)
		api.DELETE("/catalog/clear", h.ClearCatalog)
		api.GET("/catalog/barcode/:code", h.LookupBarcode)
		api.GET("/catalog/changes", h.GetProductChanges)

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

// ClearCatalog handles DELETE /api/catalog
// Deletes all products and import history from the catalog
func (h *CatalogHandler) ClearCatalog(c *gin.Context) {
	deleted, err := h.service.ClearCatalog(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "clear_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Catálogo borrado exitosamente",
		"deleted_products": deleted,
	})
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
		"id":                   imp.ID,
		"file_name":            imp.FileName,
		"store_name":           imp.StoreName,
		"imported_by":          imp.ImportedByName,
		"new_products":         imp.NewProducts,
		"price_up":             imp.PriceUpCount,
		"price_down":           imp.PriceDownCount,
		"unchanged":            imp.UnchangedCount,
		"total_value":          imp.TotalValue,
		"previous_value":       imp.PreviousValue,
		"economic_impact_up":   imp.EconomicImpactUp,
		"economic_impact_down": imp.EconomicImpactDown,
		"status":               imp.Status,
		"created_at":           imp.CreatedAt,
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
