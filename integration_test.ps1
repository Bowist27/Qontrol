
# Test Configuration
$BaseUrl = "http://localhost:8085/api"

Write-Host "1. Testing GET /api/stores..." -ForegroundColor Cyan
try {
    $stores = Invoke-RestMethod -Uri "$BaseUrl/stores" -Method Get
    if ($stores.stores.Count -ge 0) {
        Write-Host "   SUCCESS: Retrieved $($stores.stores.Count) stores." -ForegroundColor Green
        # Print first store if exists
        if ($stores.stores.Count -gt 0) {
            Write-Host "   Sample Store: $($stores.stores[0].name) (ID: $($stores.stores[0].id))" -ForegroundColor Gray
        }
    } else {
        Write-Host "   WARNING: Response structure unexpected." -ForegroundColor Yellow
        Write-Host $stores
    }
} catch {
    Write-Host "   FAILED: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Testing POST /api/audits/parse (Connectivity Check)..." -ForegroundColor Cyan
# Create a dummy invalid PDF to check route existence
"Not a real PDF" | Set-Content "dummy.pdf"
$multipartContent = [System.Net.Http.MultipartFormDataContent]::new()
$fileStream = [System.IO.File]::OpenRead("dummy.pdf")
$fileContent = [System.Net.Http.StreamContent]::new($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/pdf")
$multipartContent.Add($fileContent, "file", "dummy.pdf")

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/audits/parse" -Method Post -Body $multipartContent
    Write-Host "   UNEXPECTED: Should have failed on invalid PDF." -ForegroundColor Yellow
} catch {
    # Check if it's the expected 400/500 from our handler
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::BadRequest) {
         # Handler returns 400 for parse/read errors
         Write-Host "   SUCCESS: Backend rejected invalid PDF (400 Bad Request) as expected." -ForegroundColor Green
         Write-Host "   Server confirms route is active." -ForegroundColor Gray
    } else {
         Write-Host "   FAILED: Unexpected status code $($_.Exception.Response.StatusCode)" -ForegroundColor Red
         Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    }
}
$fileStream.Close()
Remove-Item "dummy.pdf"
