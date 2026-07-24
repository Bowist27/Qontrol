package handlers

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// electronUpdatesBase is the public S3 prefix where electron-builder publishes
// the desktop app (see apps/app-pos-electron/package.json -> build.publish.url).
const electronUpdatesBase = "https://comex-auditorias-2026-production.s3.mx-central-1.amazonaws.com/electron-updates"

// AppDownload redirects the caller to the current desktop-app installer.
// It reads electron-builder's latest.yml to resolve the versioned installer
// filename, so the download link never goes stale when a new version ships.
// Public endpoint (no auth) so any web-admin user can download the app.
func AppDownload(c *gin.Context) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(electronUpdatesBase + "/latest.yml")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo contactar el servidor de actualizaciones"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "no se encontró la versión más reciente"})
		return
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo leer la versión más reciente"})
		return
	}

	installer := parseLatestYmlPath(string(data))
	if installer == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "no se encontró el instalador en latest.yml"})
		return
	}

	// The path may include a version subfolder and spaces
	// (e.g. "1.6.0/Qontrol POS Setup 1.6.0.exe"), so escape each segment
	// individually while keeping the "/" separators intact.
	segments := strings.Split(installer, "/")
	for i, seg := range segments {
		segments[i] = url.PathEscape(seg)
	}
	c.Redirect(http.StatusFound, electronUpdatesBase+"/"+strings.Join(segments, "/"))
}

// parseLatestYmlPath extracts the top-level `path:` value from electron-builder's
// latest.yml without pulling in a YAML dependency. Returns "" if not found.
func parseLatestYmlPath(y string) string {
	for _, line := range strings.Split(y, "\n") {
		if strings.HasPrefix(line, "path:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "path:"))
		}
	}
	return ""
}
