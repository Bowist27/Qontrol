package handlers

import (
	"io"
	"net/http"
	"strconv"

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

	// TODO: Get user ID from JWT context
	var createdBy *string = nil

	// Call service - now saves everything (session + S3 + items)
	result, err := h.service.CreateAudit(c.Request.Context(), storeID, pdfData, createdBy)
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

// RegisterRoutes sets up the routes
func (h *AuditHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/stores", h.ListStores)
		api.GET("/audits", h.ListAudits)      // Dashboard list
		api.POST("/audits/parse", h.ParsePDF) // FASE 3: Preview only
		api.POST("/audits", h.CreateAudit)    // FASE 5: Save after confirm
		api.GET("/audits/:id", h.GetAudit)
		api.DELETE("/audits/:id", h.DeleteAudit) // Cancel/Delete audit
	}
}
