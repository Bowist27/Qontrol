# =====================================================
# QONTROL - Backup Completo de Producción (AWS)
# =====================================================
# MODO DE USO:
#
#   1. BACKUP COMPLETO (BD + S3):
#      .\backup_full.ps1 -SSHKey "C:\ruta\a\tu\key.pem" -SSHHost "ubuntu@<IP-EC2>"
#
#   2. SOLO S3 (si ya tienes el dump de la BD):
#      .\backup_full.ps1 -SkipDB
#
#   3. SOLO BASE DE DATOS:
#      .\backup_full.ps1 -SkipS3 -SSHKey "C:\ruta\a\tu\key.pem" -SSHHost "ubuntu@<IP-EC2>"
#
# =====================================================

param(
    [string]$BackupDir = "",
    [string]$SSHKey = "",
    [string]$SSHHost = "",
    [string]$RemoteProjectDir = "~/Comex_Adrian/Base",
    [switch]$SkipS3,
    [switch]$SkipDB,
    [string]$S3Bucket = "",
    [string]$AWSRegion = ""
)

# =====================================================
# CONFIGURACIÓN
# =====================================================
$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$scriptDir = $PSScriptRoot

# Directorio de backup
if (-not $BackupDir) {
    $BackupDir = Join-Path (Split-Path $scriptDir) "backups\backup_$timestamp"
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  QONTROL - BACKUP DE PRODUCCION (AWS)" -ForegroundColor Cyan
Write-Host "  Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Crear directorio de backup
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Write-Host "[OK] Directorio de backup: $BackupDir" -ForegroundColor Green
Write-Host ""

# =====================================================
# CARGAR VARIABLES DE .env
# =====================================================
$envFile = Join-Path (Split-Path $scriptDir) ".env"
if (Test-Path $envFile) {
    Write-Host "[INFO] Cargando credenciales desde .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            switch ($key) {
                "AWS_S3_BUCKET"       { if (-not $S3Bucket)  { $S3Bucket = $val } }
                "AWS_REGION"          { if (-not $AWSRegion)  { $AWSRegion = $val } }
                "ACCESS_KEY"          { $env:AWS_ACCESS_KEY_ID = $val }
                "SECRET_ACCESS_KEY"   { $env:AWS_SECRET_ACCESS_KEY = $val }
            }
        }
    }
}

# Defaults
if (-not $S3Bucket)  { $S3Bucket  = "comex-auditorias-2026-production" }
if (-not $AWSRegion) { $AWSRegion = "mx-central-1" }

# =====================================================
# 1. BACKUP DE BASE DE DATOS (vía SSH a EC2)
# =====================================================
if (-not $SkipDB) {
    Write-Host "------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[1/2] RESPALDANDO BASE DE DATOS PostgreSQL..." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------" -ForegroundColor DarkGray

    if (-not $SSHKey -or -not $SSHHost) {
        Write-Host ""
        Write-Host "  [!] Para respaldar la BD necesito acceso SSH al servidor EC2." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Opciones:" -ForegroundColor White
        Write-Host "    a) Pasa los parametros -SSHKey y -SSHHost:" -ForegroundColor White
        Write-Host "       .\backup_full.ps1 -SSHKey 'C:\Users\joser\.ssh\tu-key.pem' -SSHHost 'ubuntu@TU-IP-EC2'" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "    b) Conéctate manualmente al servidor y corre este comando:" -ForegroundColor White
        Write-Host ""
        Write-Host "       # En tu servidor EC2:" -ForegroundColor DarkCyan
        Write-Host "       cd $RemoteProjectDir" -ForegroundColor White
        Write-Host "       CONTAINER=`$(docker ps --filter 'ancestor=postgres:15-alpine' --format '{{.Names}}' | head -1)" -ForegroundColor White
        Write-Host '       docker exec $CONTAINER pg_dump -U admin -d qontrol --no-owner --clean --if-exists > /tmp/qontrol_backup.sql' -ForegroundColor White
        Write-Host ""
        Write-Host "       # Luego desde tu PC descarga el archivo:" -ForegroundColor DarkCyan
        Write-Host "       scp -i tu-key.pem ubuntu@TU-IP:/tmp/qontrol_backup.sql .\backups\" -ForegroundColor White
        Write-Host ""

        # Buscar archivos .pem en ubicaciones comunes
        Write-Host "  Buscando llaves SSH en tu PC..." -ForegroundColor Yellow
        $sshPaths = @(
            "$env:USERPROFILE\.ssh\*.pem",
            "$env:USERPROFILE\Desktop\*.pem",
            "$env:USERPROFILE\Downloads\*.pem"
        )
        $foundKeys = @()
        foreach ($p in $sshPaths) {
            $keys = Get-Item $p -ErrorAction SilentlyContinue
            if ($keys) { $foundKeys += $keys }
        }
        if ($foundKeys.Count -gt 0) {
            Write-Host "  Llaves .pem encontradas:" -ForegroundColor Green
            foreach ($k in $foundKeys) {
                Write-Host "    → $($k.FullName)" -ForegroundColor White
            }
        } else {
            Write-Host "  No se encontraron archivos .pem" -ForegroundColor DarkGray
        }
        Write-Host ""
    } else {
        # Tenemos SSH, procedemos automáticamente
        Write-Host "  SSH Host: $SSHHost" -ForegroundColor White
        Write-Host "  SSH Key:  $SSHKey" -ForegroundColor White
        Write-Host ""

        $dbBackupDir = Join-Path $BackupDir "database"
        New-Item -ItemType Directory -Path $dbBackupDir -Force | Out-Null

        # Paso 1: Crear dump en el servidor remoto
        Write-Host "  [1/3] Creando dump en servidor remoto..." -ForegroundColor White
        $remoteDumpPath = "/tmp/qontrol_backup_${timestamp}.sql"
        $remoteCmd = @"
CONTAINER=`$(docker ps --filter 'ancestor=postgres:15-alpine' --format '{{.Names}}' | head -1) && \
if [ -z "`$CONTAINER" ]; then \
  CONTAINER=`$(docker ps --filter 'name=postgres' --format '{{.Names}}' | head -1); \
fi && \
echo "Usando contenedor: `$CONTAINER" && \
docker exec `$CONTAINER pg_dump -U admin -d qontrol --no-owner --no-privileges --clean --if-exists > $remoteDumpPath && \
echo "DUMP_SIZE=`$(du -h $remoteDumpPath | cut -f1)" && \
echo "DUMP_OK"
"@

        $sshResult = ssh -i $SSHKey -o StrictHostKeyChecking=no $SSHHost $remoteCmd 2>&1
        $sshOutput = $sshResult -join "`n"

        if ($sshOutput -match "DUMP_OK") {
            $dumpSize = if ($sshOutput -match "DUMP_SIZE=(.+)") { $matches[1] } else { "?" }
            Write-Host "  [OK] Dump creado en servidor ($dumpSize)" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Fallo al crear el dump:" -ForegroundColor Red
            Write-Host "  $sshOutput" -ForegroundColor Red
            Write-Host ""
            Write-Host "  Continuando con S3..." -ForegroundColor Yellow
            $SkipDBDownload = $true
        }

        if (-not $SkipDBDownload) {
            # Paso 2: Descargar el dump
            Write-Host "  [2/3] Descargando dump a tu PC..." -ForegroundColor White
            $localDumpFile = Join-Path $dbBackupDir "qontrol_full_dump.sql"
            scp -i $SSHKey -o StrictHostKeyChecking=no "${SSHHost}:${remoteDumpPath}" $localDumpFile 2>&1 | Out-Null

            if (Test-Path $localDumpFile) {
                $localSize = [math]::Round((Get-Item $localDumpFile).Length / 1MB, 2)
                Write-Host "  [OK] Dump descargado: $localSize MB" -ForegroundColor Green
            } else {
                Write-Host "  [ERROR] No se pudo descargar el dump" -ForegroundColor Red
            }

            # Paso 3: Exportar tablas individuales a CSV (las más importantes)
            Write-Host "  [3/3] Exportando tablas de auditoría a CSV..." -ForegroundColor White
            $csvDir = Join-Path $dbBackupDir "csv_tables"
            New-Item -ItemType Directory -Path $csvDir -Force | Out-Null

            $auditTables = @(
                "audit_sessions",
                "audit_theoretical",
                "audit_physical",
                "audit_events",
                "products",
                "stores",
                "users",
                "roles",
                "catalog_imports",
                "catalog_import_items",
                "user_stores",
                "user_permissions"
            )

            foreach ($table in $auditTables) {
                $remoteCsvCmd = @"
CONTAINER=`$(docker ps --filter 'ancestor=postgres:15-alpine' --format '{{.Names}}' | head -1) && \
if [ -z "`$CONTAINER" ]; then CONTAINER=`$(docker ps --filter 'name=postgres' --format '{{.Names}}' | head -1); fi && \
docker exec `$CONTAINER psql -U admin -d qontrol -c \"COPY (SELECT * FROM $table) TO STDOUT WITH CSV HEADER\"
"@
                $csvFile = Join-Path $csvDir "$table.csv"
                $csvResult = ssh -i $SSHKey -o StrictHostKeyChecking=no $SSHHost $remoteCsvCmd 2>$null
                if ($csvResult) {
                    $csvResult | Out-File -FilePath $csvFile -Encoding UTF8
                    $rowCount = ($csvResult | Measure-Object).Count - 1
                    Write-Host "    [OK] $table → $rowCount registros" -ForegroundColor Green
                } else {
                    Write-Host "    [WARN] $table → sin datos o error" -ForegroundColor Yellow
                }
            }

            # Limpiar dump remoto
            ssh -i $SSHKey -o StrictHostKeyChecking=no $SSHHost "rm -f $remoteDumpPath" 2>$null
        }
    }
    Write-Host ""
}

# =====================================================
# 2. BACKUP DE S3 (directo desde tu PC)
# =====================================================
if (-not $SkipS3) {
    Write-Host "------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[2/2] RESPALDANDO ARCHIVOS DE S3..." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Bucket: $S3Bucket" -ForegroundColor White
    Write-Host "  Region: $AWSRegion" -ForegroundColor White
    Write-Host ""

    $s3BackupDir = Join-Path $BackupDir "s3_files"
    New-Item -ItemType Directory -Path $s3BackupDir -Force | Out-Null

    # Verificar AWS CLI
    $awsCli = Get-Command aws -ErrorAction SilentlyContinue
    if ($awsCli) {
        # Listar archivos primero
        Write-Host "  Listando archivos en S3..." -ForegroundColor White
        $fileList = aws s3 ls "s3://$S3Bucket/" --recursive --region $AWSRegion 2>&1
        if ($LASTEXITCODE -eq 0 -and $fileList) {
            $fileCount = ($fileList | Measure-Object).Count
            $totalS3Size = ($fileList | ForEach-Object {
                if ($_ -match '\s+(\d+)\s+') { [long]$matches[1] }
            } | Measure-Object -Sum).Sum
            $s3SizeFormatted = [math]::Round($totalS3Size / 1MB, 2)
            Write-Host "  Encontrados $fileCount archivos ($s3SizeFormatted MB total)" -ForegroundColor White

            # Guardar listado
            $fileList | Out-File -FilePath (Join-Path $s3BackupDir "_file_listing.txt") -Encoding UTF8
        } else {
            Write-Host "  [WARN] No se pudo listar el bucket. Verificar credenciales." -ForegroundColor Yellow
            Write-Host "  Output: $fileList" -ForegroundColor DarkGray
        }

        # Descargar todo
        Write-Host "  Descargando archivos (esto puede tomar unos minutos)..." -ForegroundColor White
        $syncOutput = aws s3 sync "s3://$S3Bucket/" $s3BackupDir --region $AWSRegion 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $downloadedFiles = (Get-ChildItem $s3BackupDir -Recurse -File | Where-Object { $_.Name -ne "_file_listing.txt" } | Measure-Object).Count
            $downloadedSize = (Get-ChildItem $s3BackupDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Host "  [OK] $downloadedFiles archivos descargados ($([math]::Round($downloadedSize, 2)) MB)" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Error al descargar:" -ForegroundColor Red
            Write-Host "  $syncOutput" -ForegroundColor Red
        }
    } else {
        Write-Host ""
        Write-Host "  [ERROR] AWS CLI no esta instalado." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Para instalar:" -ForegroundColor Yellow
        Write-Host "    winget install Amazon.AWSCLI" -ForegroundColor White
        Write-Host "    # o descarga de: https://aws.amazon.com/cli/" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Despues de instalar, configura las credenciales:" -ForegroundColor Yellow
        Write-Host "    aws configure" -ForegroundColor White
        Write-Host "    # Access Key: (del .env → ACCESS_KEY)" -ForegroundColor DarkGray
        Write-Host "    # Secret Key: (del .env → SECRET_ACCESS_KEY)" -ForegroundColor DarkGray
        Write-Host "    # Region: $AWSRegion" -ForegroundColor DarkGray
    }

    Write-Host ""
}

# =====================================================
# 3. GENERAR METADATOS DEL BACKUP
# =====================================================
$metadataFile = Join-Path $BackupDir "BACKUP_INFO.txt"
@"
=====================================================
QONTROL - BACKUP DE PRODUCCION
=====================================================
Fecha:               $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Bucket S3:           $S3Bucket
Region AWS:          $AWSRegion
Servidor:            $SSHHost
Directorio:          $BackupDir

CONTENIDO:
  /database/
    qontrol_full_dump.sql    → Dump completo (restaurable)
    /csv_tables/             → Tablas individuales en CSV
      audit_sessions.csv     → Sesiones de auditoria
      audit_theoretical.csv  → Inventario teorico (del PDF)
      audit_physical.csv     → Escaneos fisicos (de la app)
      audit_events.csv       → Bitacora de eventos
      products.csv           → Catalogo de productos
      stores.csv             → Tiendas
      users.csv              → Usuarios
      ...

  /s3_files/
    → PDFs y archivos subidos a S3

COMO RESTAURAR:
  1. Base de datos (conectado al servidor EC2):
     cat qontrol_full_dump.sql | docker exec -i CONTAINER psql -U admin -d qontrol

  2. Archivos S3:
     aws s3 sync s3_files/ s3://$S3Bucket/ --region $AWSRegion
=====================================================
"@ | Out-File -FilePath $metadataFile -Encoding UTF8

# =====================================================
# RESUMEN FINAL
# =====================================================
$totalBackupSize = (Get-ChildItem $BackupDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
$sizeFormatted = if ($totalBackupSize -gt 1GB) {
    "$([math]::Round($totalBackupSize / 1GB, 2)) GB"
} elseif ($totalBackupSize -gt 1MB) {
    "$([math]::Round($totalBackupSize / 1MB, 2)) MB"
} else {
    "$([math]::Round($totalBackupSize / 1KB, 2)) KB"
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  BACKUP COMPLETADO" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Directorio:   $BackupDir" -ForegroundColor White
Write-Host "  Tamano total: $sizeFormatted" -ForegroundColor White
Write-Host ""
Write-Host "  Para comprimir:" -ForegroundColor Yellow
Write-Host "  Compress-Archive -Path '$BackupDir\*' -DestinationPath '$BackupDir.zip'" -ForegroundColor White
Write-Host ""
