package handlers

import (
	"fmt"
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
// Returns audits filtered by the requesting user's assigned stores.
// Admins see all audits; other roles only see audits for their stores.
func (h *AuditHandler) GetAudits(c *gin.Context) {
	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	audits, err := h.service.GetAudits(c.Request.Context(), fmt.Sprintf("%v", userID), fmt.Sprintf("%v", role))
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
// Returns stores filtered by the user's assignments (admins see all)
// POS routes (no auth) see all stores
func (h *AuditHandler) ListStores(c *gin.Context) {
	userID, hasUser := c.Get("userID")
	role, _ := c.Get("role")

	var stores []domain.Store
	var err error

	// If no auth context (POS routes), or admin → show all
	roleStr := fmt.Sprintf("%v", role)
	if !hasUser || roleStr == "Administrador" {
		stores, err = h.service.ListStores(c.Request.Context(), "", "Administrador")
	} else {
		stores, err = h.service.ListStores(c.Request.Context(), fmt.Sprintf("%v", userID), roleStr)
	}
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

	// Get optional audit name from form
	var name *string
	if n := c.PostForm("name"); n != "" {
		name = &n
	}

	// Call service - now saves everything (session + S3 + items)
	// Pass original filename to preserve it in S3 key
	result, err := h.service.CreateAudit(c.Request.Context(), storeID, pdfData, createdBy, header.Filename, name)
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
		api.GET("/audits/active", h.ListActiveAudits)                // Audits available for POS
		api.POST("/audits/:id/scans", h.AddScan)                     // Add scan from POS
		api.GET("/audits/:id/scans", h.GetScans)                     // Get all scans
		api.GET("/audits/:id/scans/summary", h.GetScanSummary)       // Get summary
		api.DELETE("/audits/:id/scans/last", h.UndoLastScan)         // Undo last scan
		api.PUT("/audits/:id/scans/modify", h.ModifyProductQuantity) // Modify product quantity
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
		api.GET("/audits/:id/events", h.GetAuditEvents)                  // Audit Logs
		api.DELETE("/audits/:id", h.DeleteAudit)                         // Cancel/Delete audit
		api.PATCH("/audits/:id/close", h.CloseAudit)                     // Close audit
		api.PATCH("/audits/:id/reopen", h.ReopenAudit)                   // Reopen audit
		api.GET("/reopen-requests", h.GetPendingReopenRequests)          // Pending reopen requests
		api.GET("/audits/:id/reopen-requests", h.GetAuditReopenRequests) // Reopen requests for specific audit
	}

	// POS device routes (no JWT - POS authenticates locally via SQLite)
	pos := router.Group("/api")
	{
		pos.GET("/audits/active", h.ListActiveAudits)                      // Audits available for POS
		pos.POST("/audits/:id/scans", h.AddScan)                           // Add scan from POS
		pos.GET("/audits/:id/scans", h.GetScans)                           // Get all scans
		pos.GET("/audits/:id/scans/summary", h.GetScanSummary)             // Get summary
		pos.DELETE("/audits/:id/scans/last", h.UndoLastScan)               // Undo last scan
		pos.PUT("/audits/:id/scans/modify", h.ModifyProductQuantity)       // Modify product quantity
		pos.PATCH("/audits/:id/close-from-pos", h.CloseAuditFromPOS)       // POS finalize
		pos.GET("/pos/stores", h.ListStores)                               // Stores for POS
		pos.POST("/pos/audits", h.CreateAuditFromPOS)                      // Create empty audit from POS
		pos.POST("/pos/audits/:id/reopen-request", h.RequestReopenFromPOS) // Request reopen from POS
	}
}

// CloseAuditFromPOS handles PATCH /api/audits/:id/close-from-pos
// POS-accessible endpoint (no JWT) - uses device_id as identifier
func (h *AuditHandler) CloseAuditFromPOS(c *gin.Context) {
	auditIDStr := c.Param("id")
	auditID, err := strconv.Atoi(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	var req struct {
		DeviceID string `json:"device_id"`
		ClosedBy string `json:"closed_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "device_id is required",
		})
		return
	}

	userID := req.ClosedBy
	if userID == "" {
		userID = "pos-device:" + req.DeviceID
	}

	err = h.service.CloseAudit(c.Request.Context(), auditID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "close_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Audit finalized successfully from POS"})
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

// ModifyProductQuantity handles PUT /api/audits/:id/scans/modify
func (h *AuditHandler) ModifyProductQuantity(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	var req struct {
		Barcode     string  `json:"barcode" binding:"required"`
		NewQuantity float64 `json:"new_quantity" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	err = h.service.ModifyProductQuantity(c.Request.Context(), auditID, req.Barcode, req.NewQuantity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "modify_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "barcode": req.Barcode, "new_quantity": req.NewQuantity})
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

// CreateAuditFromPOS handles POST /api/pos/audits
// POS-accessible endpoint (no JWT) - creates an empty audit session
func (h *AuditHandler) CreateAuditFromPOS(c *gin.Context) {
	var req struct {
		StoreID   int    `json:"store_id" binding:"required"`
		DeviceID  string `json:"device_id"`
		CreatedBy string `json:"created_by"`
		Name      string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "store_id is required",
		})
		return
	}

	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "pos-device:" + req.DeviceID
	}

	var name *string
	if req.Name != "" {
		name = &req.Name
	}

	session, err := h.service.CreateAuditFromPOS(c.Request.Context(), req.StoreID, createdBy, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "create_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"session": session,
	})
}

// RequestReopenFromPOS handles POST /api/pos/audits/:id/reopen-request
// POS-accessible endpoint (no JWT) - creates a reopen request for admin approval
func (h *AuditHandler) RequestReopenFromPOS(c *gin.Context) {
	auditIDStr := c.Param("id")
	auditID, err := strconv.Atoi(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	var req struct {
		DeviceID    string `json:"device_id"`
		RequestedBy string `json:"requested_by"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Request body is required",
		})
		return
	}

	requestedBy := req.RequestedBy
	if requestedBy == "" {
		requestedBy = "pos-device:" + req.DeviceID
	}

	reopenReq, err := h.service.RequestReopenAudit(c.Request.Context(), auditID, requestedBy, req.DeviceID, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "request_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"request": reopenReq,
	})
}

// GetPendingReopenRequests handles GET /api/reopen-requests
// Returns pending reopen requests filtered by user's store assignments
func (h *AuditHandler) GetPendingReopenRequests(c *gin.Context) {
	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	requests, err := h.service.GetPendingReopenRequests(c.Request.Context(), fmt.Sprintf("%v", userID), fmt.Sprintf("%v", role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "fetch_failed",
			Message: err.Error(),
		})
		return
	}
	if requests == nil {
		requests = []domain.ReopenRequest{}
	}
	c.JSON(http.StatusOK, gin.H{"requests": requests})
}

// GetAuditReopenRequests handles GET /api/audits/:id/reopen-requests
// Returns pending reopen requests for a specific audit
func (h *AuditHandler) GetAuditReopenRequests(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_id",
			Message: "ID must be a valid integer",
		})
		return
	}

	requests, err := h.service.GetPendingReopenRequestsForAudit(c.Request.Context(), auditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "fetch_failed",
			Message: err.Error(),
		})
		return
	}
	if requests == nil {
		requests = []domain.ReopenRequest{}
	}
	c.JSON(http.StatusOK, gin.H{"requests": requests})
}
