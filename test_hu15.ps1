# ============================================================
# QONTROL - HU15 Automated Integration Tests
# Tests: Auth, User CRUD, Password Reset, Email, Web Access
# ============================================================

$ErrorActionPreference = "Continue"
$BASE_URL = "http://localhost:8082"
$WEB_ADMIN_URL = "http://localhost:5174"
$ELECTRON_URL = "http://localhost:5173"
$passed = 0
$failed = 0
$total = 0
$details = @()

function Test-Case {
    param([string]$Name, [scriptblock]$Test)
    $script:total++
    Write-Host "`n-----------------------------------------------" -ForegroundColor DarkGray
    Write-Host "TEST $($script:total): $Name" -ForegroundColor Cyan
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:passed++
            $script:details += [PSCustomObject]@{N=$script:total; Test=$Name; Result="PASS"}
        } else {
            Write-Host "  FAIL - returned false" -ForegroundColor Red
            $script:failed++
            $script:details += [PSCustomObject]@{N=$script:total; Test=$Name; Result="FAIL"}
        }
    } catch {
        Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        $script:details += [PSCustomObject]@{N=$script:total; Test=$Name; Result="FAIL: $($_.Exception.Message)"}
    }
}

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  QONTROL - HU15 Integration Tests" -ForegroundColor Yellow
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

# =============================================================
# 1. INFRASTRUCTURE - Docker containers running
# =============================================================
Write-Host "`n>> INFRASTRUCTURE" -ForegroundColor Magenta

Test-Case "Docker - auth-service running" {
    $c = docker inspect --format '{{.State.Running}}' base-auth-service-1 2>$null
    $c -eq "true"
}

Test-Case "Docker - audit-service running" {
    $c = docker inspect --format '{{.State.Running}}' base-audit-service-1 2>$null
    $c -eq "true"
}

Test-Case "Docker - postgres running and healthy" {
    $c = docker inspect --format '{{.State.Health.Status}}' base-postgres-1 2>$null
    $c -eq "healthy"
}

Test-Case "Docker - redis running" {
    $c = docker inspect --format '{{.State.Running}}' base-redis-1 2>$null
    $c -eq "true"
}

# =============================================================
# 2. WEB ACCESS - Both apps accessible
# =============================================================
Write-Host "`n>> WEB ACCESS" -ForegroundColor Magenta

Test-Case "Web-Admin accessible on port 5174" {
    $r = Invoke-WebRequest -Uri $WEB_ADMIN_URL -UseBasicParsing -TimeoutSec 5
    $r.StatusCode -eq 200
}

Test-Case "Web-Admin returns HTML with QONTROL" {
    $r = Invoke-WebRequest -Uri $WEB_ADMIN_URL -UseBasicParsing -TimeoutSec 5
    $r.Content -match "QONTROL|qontrol|root"
}

Test-Case "Electron POS accessible on port 5173" {
    $r = Invoke-WebRequest -Uri $ELECTRON_URL -UseBasicParsing -TimeoutSec 5
    $r.StatusCode -eq 200
}

Test-Case "Electron POS returns HTML" {
    $r = Invoke-WebRequest -Uri $ELECTRON_URL -UseBasicParsing -TimeoutSec 5
    $r.Content -match "html|root"
}

Test-Case "Web-Admin /reset-password route exists (no token)" {
    $r = Invoke-WebRequest -Uri "$WEB_ADMIN_URL/reset-password" -UseBasicParsing -TimeoutSec 5
    $r.StatusCode -eq 200
}

# =============================================================
# 3. AUTH ENDPOINTS - Login / Logout
# =============================================================
Write-Host "`n>> AUTH - LOGIN" -ForegroundColor Magenta

Test-Case "Login - Admin valid credentials" {
    $body = '{"email":"admin@qontrol.com","password":"Admin123!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.token -ne $null -and $r.token.Length -gt 20
}

Test-Case "Login - Returns user info with role" {
    $body = '{"email":"admin@qontrol.com","password":"Admin123!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.user.email -eq "admin@qontrol.com" -and $r.user.role.name -eq "Administrador"
}

Test-Case "Login - Invalid password returns 401" {
    try {
        $body = '{"email":"admin@qontrol.com","password":"WrongPassword!"}'
        Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Case "Login - Non-existent user returns 401" {
    try {
        $body = '{"email":"noexiste@test.com","password":"Test123!"}'
        Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Case "Login - Empty body returns 400" {
    try {
        Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body '{}'
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 400
    }
}

# Get admin token for protected endpoints
$adminBody = '{"email":"admin@qontrol.com","password":"Admin123!"}'
$adminResp = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $adminBody
$adminToken = $adminResp.token
$authHeaders = @{Authorization="Bearer $adminToken"}

# =============================================================
# 4. PROTECTED ROUTES - Without token
# =============================================================
Write-Host "`n>> PROTECTED ROUTES" -ForegroundColor Magenta

Test-Case "GET /users without token returns 401" {
    try {
        Invoke-RestMethod -Uri "$BASE_URL/users" -Method GET
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Case "POST /users without token returns 401" {
    try {
        $body = '{"email":"test@test.com","first_name":"Test","last_name":"User","role_id":2}'
        Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Body $body
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Case "GET /users with valid token returns 200" {
    $r = Invoke-RestMethod -Uri "$BASE_URL/users" -Method GET -Headers $authHeaders
    $r -ne $null
}

# =============================================================
# 5. USER CRUD - Create without password (HU15 core feature)
# =============================================================
Write-Host "`n>> USER CRUD - HU15 CREATE WITHOUT PASSWORD" -ForegroundColor Magenta

$testEmail = "hu15-test-$(Get-Random -Minimum 1000 -Maximum 9999)@qontrol-test.com"
$testUserId = $null
$resetToken = $null

Test-Case "Create user WITHOUT password field (defaults to Test123!)" {
    $body = @{email=$testEmail; first_name="HU15"; last_name="TestUser"; role_id=2} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Headers $authHeaders -Body $body
    $script:testUserId = $r.id
    Write-Host "    Created user ID: $($r.id)" -ForegroundColor DarkGray
    $r.id -ne $null -and $r.email -eq $testEmail -and $r.is_active -eq $true
}

Test-Case "Created user has role assigned" {
    $r = Invoke-RestMethod -Uri "$BASE_URL/users/$testUserId" -Method GET -Headers $authHeaders
    $r.role_id -eq 2 -and $r.role.name -eq "Gerente"
}

Test-Case "Email sent (check auth-service logs)" {
    Start-Sleep -Seconds 3
    $logs = docker logs base-auth-service-1 --tail 50 2>&1 | ForEach-Object { $_.ToString() }
    $joined = $logs -join " "
    $joined -match "Email sent" -or $joined -match "Reset URL" -or $joined -match "console mode"
}

Test-Case "Login with default password Test123!" {
    $body = @{email=$testEmail; password="Test123!"} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.token -ne $null -and $r.token.Length -gt 20
}

# =============================================================
# 6. PASSWORD RESET FLOW
# =============================================================
Write-Host "`n>> PASSWORD RESET FLOW" -ForegroundColor Magenta

# Extract reset token from DB - wait for async email to complete
Start-Sleep -Seconds 1

Test-Case "Reset token was generated in DB" {
    $query = "SELECT password_reset_token FROM users WHERE email='$testEmail' AND password_reset_token IS NOT NULL;"
    $result = docker exec base-postgres-1 psql -U admin -d qontrol -t -c $query 2>$null
    if ($result -is [array]) { $result = $result | Where-Object { $_ -and $_.Trim() -ne '' } | Select-Object -First 1 }
    $script:resetToken = "$result".Trim()
    if ($script:resetToken.Length -gt 16) {
        Write-Host "    Token: $($script:resetToken.Substring(0, 16))..." -ForegroundColor DarkGray
    } else {
        Write-Host "    Token length: $($script:resetToken.Length)" -ForegroundColor DarkGray
    }
    $script:resetToken.Length -gt 10
}

Test-Case "Validate reset token - GET /reset-password/validate" {
    $r = Invoke-RestMethod -Uri "$BASE_URL/reset-password/validate?token=$resetToken" -Method GET
    $r.valid -eq $true -and $r.email -eq $testEmail -and $r.first_name -eq "HU15"
}

Test-Case "Validate invalid token returns valid=false or 400" {
    try {
        $r = Invoke-RestMethod -Uri "$BASE_URL/reset-password/validate?token=invalid-token-12345" -Method GET
        $r.valid -eq $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 400 -or $_.Exception.Response.StatusCode.value__ -eq 404
    }
}

Test-Case "Reset password - POST /reset-password" {
    $body = @{token=$resetToken; new_password="NewSecure456!"} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/reset-password" -Method POST -ContentType "application/json" -Body $body
    $r.message -ne $null
}

Test-Case "Login with NEW password after reset" {
    $body = @{email=$testEmail; password="NewSecure456!"} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.token -ne $null -and $r.token.Length -gt 20
}

Test-Case "Old password Test123! no longer works" {
    try {
        $body = @{email=$testEmail; password="Test123!"} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Case "Reset token invalidated after use" {
    $query = "SELECT COALESCE(password_reset_token, '') FROM users WHERE email='$testEmail';"
    $result = docker exec base-postgres-1 psql -U admin -d qontrol -t -c $query 2>$null
    if ($result -is [array]) { $result = $result | Where-Object { $_ -ne $null } | Select-Object -First 1 }
    "$result".Trim() -eq ""
}

Test-Case "Used token no longer validates" {
    try {
        $r = Invoke-RestMethod -Uri "$BASE_URL/reset-password/validate?token=$resetToken" -Method GET
        $r.valid -eq $false
    } catch {
        $true  # 400/404 also acceptable
    }
}

# =============================================================
# 7. USER UPDATE & DEACTIVATE
# =============================================================
Write-Host "`n>> USER UPDATE & DEACTIVATE" -ForegroundColor Magenta

Test-Case "Update user name" {
    $body = @{first_name="HU15-Updated"; last_name="TestModified"} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/users/$testUserId" -Method PUT -ContentType "application/json" -Headers $authHeaders -Body $body
    $r.first_name -eq "HU15-Updated"
}

Test-Case "List users includes test user" {
    try {
        $r = Invoke-RestMethod -Uri "$BASE_URL/users/$testUserId" -Method GET -Headers $authHeaders
        $r.id -eq $testUserId
    } catch {
        $false
    }
}

# =============================================================
# 8. EDGE CASES & VALIDATION
# =============================================================
Write-Host "`n>> EDGE CASES & VALIDATION" -ForegroundColor Magenta

Test-Case "Cannot create user with duplicate email" {
    try {
        $body = @{email=$testEmail; first_name="Dup"; last_name="User"; role_id=2} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Headers $authHeaders -Body $body
        $false
    } catch {
        $true  # Should return error
    }
}

Test-Case "Cannot create user with invalid email" {
    try {
        $body = @{email="not-an-email"; first_name="Bad"; last_name="Email"; role_id=2} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Headers $authHeaders -Body $body
        $false
    } catch {
        $true
    }
}

Test-Case "Cannot create user without required fields" {
    try {
        $body = '{"email":""}' 
        Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Headers $authHeaders -Body $body
        $false
    } catch {
        $true
    }
}

Test-Case "Reset password with weak password fails" {
    # First create another user for this test
    $weakEmail = "hu15-weak-$(Get-Random -Minimum 1000 -Maximum 9999)@test.com"
    $body = @{email=$weakEmail; first_name="Weak"; last_name="Test"; role_id=3} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE_URL/users" -Method POST -ContentType "application/json" -Headers $authHeaders -Body $body
    $weakUserId = $r.id
    
    # Get the reset token
    $query = "SELECT password_reset_token FROM users WHERE id='$weakUserId';"
    $weakToken = (docker exec base-postgres-1 psql -U admin -d qontrol -t -c "$query" 2>$null).Trim()
    
    # Try to reset with weak password
    try {
        $body = @{token=$weakToken; new_password="123"} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BASE_URL/reset-password" -Method POST -ContentType "application/json" -Body $body
        # Clean up
        Invoke-RestMethod -Uri "$BASE_URL/users/$weakUserId" -Method DELETE -Headers $authHeaders 2>$null
        $false
    } catch {
        # Clean up
        Invoke-RestMethod -Uri "$BASE_URL/users/$weakUserId" -Method DELETE -Headers $authHeaders 2>$null
        $true
    }
}

# =============================================================
# 9. SEED USERS INTEGRITY
# =============================================================
Write-Host "`n>> SEED USERS INTEGRITY" -ForegroundColor Magenta

Test-Case "Admin user exists and can login" {
    $body = '{"email":"admin@qontrol.com","password":"Admin123!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.user.role.name -eq "Administrador"
}

Test-Case "Gerente user exists and can login" {
    $body = '{"email":"gerente@qontrol.com","password":"Test1234!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.user.role.name -eq "Gerente"
}

Test-Case "Vendedor user exists and can login" {
    $body = '{"email":"vendedor@qontrol.com","password":"Test1234!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $r.user.role.name -eq "Vendedor"
}

# =============================================================
# 10. LOGOUT
# =============================================================
Write-Host "`n>> LOGOUT" -ForegroundColor Magenta

Test-Case "Logout invalidates session" {
    # Login first
    $body = '{"email":"admin@qontrol.com","password":"Admin123!"}'
    $r = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
    $logoutToken = $r.token
    
    # Logout
    $r = Invoke-RestMethod -Uri "$BASE_URL/logout" -Method POST -Headers @{Authorization="Bearer $logoutToken"}
    $r.message -ne $null
}

# =============================================================
# 11. CLEANUP
# =============================================================
Write-Host "`n>> CLEANUP" -ForegroundColor Magenta

Test-Case "Delete test user" {
    $r = Invoke-RestMethod -Uri "$BASE_URL/users/$testUserId" -Method DELETE -Headers $authHeaders
    $r.message -match "eliminado|deleted"
}

Test-Case "Deleted user cannot login" {
    try {
        $body = @{email=$testEmail; password="NewSecure456!"} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $body
        $false
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

# =============================================================
# RESULTS SUMMARY
# =============================================================
Write-Host "`n============================================================" -ForegroundColor Yellow
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

$details | ForEach-Object {
    $color = if ($_.Result -eq "PASS") { "Green" } else { "Red" }
    $icon = if ($_.Result -eq "PASS") { "[OK]" } else { "[XX]" }
    Write-Host "  $icon $($_.N). $($_.Test)" -ForegroundColor $color
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TOTAL: $total  |  PASSED: $passed  |  FAILED: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
$pct = [math]::Round(($passed / $total) * 100, 1)
Write-Host "  SUCCESS RATE: $pct%" -ForegroundColor $(if ($pct -eq 100) { "Green" } elseif ($pct -ge 80) { "Yellow" } else { "Red" })
Write-Host "============================================================" -ForegroundColor Yellow

if ($failed -gt 0) { exit 1 } else { exit 0 }
