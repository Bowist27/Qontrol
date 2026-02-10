package handlers

import (
	"io"
	"net/http"
	"strconv"

	"audit-service/internal/adapters/middleware"
	"audit-service/internal/core/domain"
	"audit-service/internal/core/services"

	"github.com/gin-gonic/gin"
)

// AuditHandler handles HTTP requests for audits
type AuditHandler struct {
	service *services.AuditService
}

// NewAuditHandler creates a new handler
func NewAuditHandler(service *services.AuditService) *AuditHandler {
	return &AuditHandler{service: service}
}

// GetAudits handles GET /api/audits - Dashboard endpoint (HU10)
// Returns filtered audits based on business rules
func (h *AuditHandler) GetAudits(c *gin.Context) {
	audits, err := h.service.GetAudits(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "fetch_failed",
			"message": "Error al obtener auditorías",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"audits": audits})
}

// ListStores handles GET /api/stores
func (h *AuditHandler) ListStores(c *gin.Context) {
	stores, err := h.service.ListStores(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to fetch stores",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// ParsePDF handles POST /api/audits/parse
// FASE 3: Only parses the PDF for preview, does NOT save to database
func (h *AuditHandler) ParsePDF(c *gin.Context) {
	// Get file from form
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "missing_file",
			Message: "PDF file is required",
		})
		return
	}
	defer file.Close()

	// Read file data
	pdfData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read PDF file",
		})
		return
	}

	// Call service - parse only, no save
	result, err := h.service.ParsePDF(c.Request.Context(), pdfData)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "parse_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// CreateAudit handles POST /api/audits
// FASE 5: Called AFTER user confirms preview - saves everything
func (h *AuditHandler) CreateAudit(c *gin.Context) {
	// Parse store_id from form
	storeIDStr := c.PostForm("store_id")
	storeID, err := strconv.Atoi(storeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_store_id",
			Message: "store_id must be a valid integer",
		})
		return
	}

	// Get file from form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "missing_file",
			Message: "PDF file is required",
		})
		return
	}
	defer file.Close()

	// Read file data
	pdfData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read PDF file",
		})
		return
	}

	// Get user ID from JWT context
	var createdBy *string
	if userID, exists := c.Get("userID"); exists {
		if idStr, ok := userID.(string); ok {
			createdBy = &idStr
		}
	}

	// Call service - now saves everything (session + S3 + items)
	// Pass original filename to preserve it in S3 key
	result, err := h.service.CreateAudit(c.Request.Context(), storeID, pdfData, createdBy, header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "create_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// GetAudit handles GET /api/audits/:id
func (h *AuditHandler) GetAudit(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	result, err := h.service.GetAuditByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Audit not found",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ListAudits handles GET /api/audits
func (h *AuditHandler) ListAudits(c *gin.Context) {
	audits, err := h.service.ListAudits(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "search_failed",
			Message: "Failed to list audits",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"audits": audits})
}

// DeleteAudit handles DELETE /api/audits/:id
func (h *AuditHandler) DeleteAudit(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	err = h.service.DeleteAudit(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "delete_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Audit deleted successfully"})
}

// CloseAudit handles PATCH /api/audits/:id/close
func (h *AuditHandler) CloseAudit(c *gin.Context) {
	auditIDStr := c.Param("id")
	auditID, err := strconv.Atoi(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	// Get user ID from auth middleware
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse{
			Error:   "unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	err = h.service.CloseAudit(c.Request.Context(), auditID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "close_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Audit closed successfully"})
}

// ReopenAudit handles PATCH /api/audits/:id/reopen
func (h *AuditHandler) ReopenAudit(c *gin.Context) {
	auditIDStr := c.Param("id")
	auditID, err := strconv.Atoi(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	// Get user ID from auth middleware
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse{
			Error:   "unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	err = h.service.ReopenAudit(c.Request.Context(), auditID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "reopen_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Audit reopened successfully"})
}

// RegisterRoutes sets up the routes (legacy - unprotected)
func (h *AuditHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/stores", h.ListStores)
		// api.GET("/audits", h.ListAudits)   // Removed: handled in main.go with auth and filter logic
		api.POST("/audits/parse", h.ParsePDF) // FASE 3: Preview only
		api.POST("/audits", h.CreateAudit)    // FASE 5: Save after confirm
		api.GET("/audits/:id", h.GetAudit)
		api.DELETE("/audits/:id", h.DeleteAudit) // Cancel/Delete audit

		// Physical Scan endpoints (for POS app)
		api.GET("/audits/active", h.ListActiveAudits)          // Audits available for POS
		api.POST("/audits/:id/scans", h.AddScan)               // Add scan from POS
		api.GET("/audits/:id/scans", h.GetScans)               // Get all scans
		api.GET("/audits/:id/scans/summary", h.GetScanSummary) // Get summary
		api.DELETE("/audits/:id/scans/last", h.UndoLastScan)   // Undo last scan
	}
}

// RegisterRoutesWithAuth sets up routes with authentication middleware
func (h *AuditHandler) RegisterRoutesWithAuth(router *gin.Engine, auth *middleware.AuthMiddleware) {
	// Protected routes (require JWT - for web-admin)
	api := router.Group("/api")
	api.Use(auth.RequireAuth())
	{
		api.GET("/stores", h.ListStores)
		api.POST("/audits/parse", h.ParsePDF) // FASE 3: Preview only
		api.POST("/audits", h.CreateAudit)    // FASE 5: Save after confirm
		api.PUT("/audits/:id", h.UpdateAudit) // PDF Replacement
		api.GET("/audits/:id", h.GetAudit)
		api.GET("/audits/:id/events", h.GetAuditEvents) // Audit Logs
		api.DELETE("/audits/:id", h.DeleteAudit)        // Cancel/Delete audit
		api.PATCH("/audits/:id/close", h.CloseAudit)    // Close audit
		api.PATCH("/audits/:id/reopen", h.ReopenAudit)  // Reopen audit
	}

	// POS device routes (no JWT - POS authenticates locally via SQLite)
	pos := router.Group("/api")
	{
		pos.GET("/audits/active", h.ListActiveAudits)          // Audits available for POS
		pos.POST("/audits/:id/scans", h.AddScan)               // Add scan from POS
		pos.GET("/audits/:id/scans", h.GetScans)               // Get all scans
		pos.GET("/audits/:id/scans/summary", h.GetScanSummary) // Get summary
		pos.DELETE("/audits/:id/scans/last", h.UndoLastScan)   // Undo last scan
	}
}

// ListActiveAudits returns audits available for POS app to connect
func (h *AuditHandler) ListActiveAudits(c *gin.Context) {
	audits, err := h.service.ListActiveAuditsForPOS(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "list_failed",
			Message: "Failed to list active audits",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"audits": audits})
}

// AddScan handles POST /api/audits/:id/scans
func (h *AuditHandler) AddScan(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	var req domain.AddScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}
	req.AuditID = auditID

	// Default quantity to 1 if not specified
	if req.Quantity == 0 {
		req.Quantity = 1
	}

	scan, err := h.service.AddPhysicalScan(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "scan_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"scan":    scan,
	})
}

// GetScans handles GET /api/audits/:id/scans
func (h *AuditHandler) GetScans(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	scans, err := h.service.GetPhysicalScans(c.Request.Context(), auditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "fetch_failed",
			Message: err.Error(),
		})
		return
	}

	// Ensure we return empty array instead of null
	if scans == nil {
		scans = []domain.PhysicalScan{}
	}

	c.JSON(http.StatusOK, gin.H{"scans": scans})
}

// GetScanSummary handles GET /api/audits/:id/scans/summary
func (h *AuditHandler) GetScanSummary(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	summary, err := h.service.GetPhysicalScanSummary(c.Request.Context(), auditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "fetch_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// UndoLastScan handles DELETE /api/audits/:id/scans/last
func (h *AuditHandler) UndoLastScan(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	err = h.service.UndoLastScan(c.Request.Context(), auditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "undo_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Helper to get user ID
func (h *AuditHandler) getUserIDFromContext(c *gin.Context) *string {
	val, exists := c.Get("userID")
	if !exists {
		return nil
	}
	uid, ok := val.(string)
	if !ok {
		return nil
	}
	return &uid
}

// UpdateAudit handles PUT /api/audits/:id (PDF Replacement)
func (h *AuditHandler) UpdateAudit(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{Error: "invalid_id", Message: "Invalid ID"})
		return
	}

	// Get file from form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{Error: "file_required", Message: "PDF file is required"})
		return
	}
	defer file.Close()

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Error: "read_error", Message: "Failed to read file"})
		return
	}

	// Get user ID from JWT context
	var userID *string
	if uid, exists := c.Get("userID"); exists {
		if idStr, ok := uid.(string); ok {
			userID = &idStr
		}
	}

	if err := h.service.UpdateAudit(c.Request.Context(), id, pdfBytes, userID, header.Filename); err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Error: "update_failed", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetAuditEvents handles GET /api/audits/:id/events
func (h *AuditHandler) GetAuditEvents(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{Error: "invalid_id", Message: "Invalid ID"})
		return
	}

	events, err := h.service.GetAuditEvents(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Error: "fetch_failed", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}
