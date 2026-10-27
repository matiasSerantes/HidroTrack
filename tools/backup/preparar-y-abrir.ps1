param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$runtime = Join-Path $env:LOCALAPPDATA 'HidroTrack-Backup'
$pythonHome = Join-Path $runtime 'python'
$venv = Join-Path $runtime 'venv'
$clients = Join-Path $runtime 'postgresql-client'
$pythonExe = Join-Path $pythonHome 'python.exe'
$venvPython = Join-Path $venv 'Scripts\python.exe'
$pgDump = Join-Path $clients 'pg_dump.exe'
$pgRestore = Join-Path $clients 'pg_restore.exe'

function Get-PythonInstaller {
    $html = (Invoke-WebRequest 'https://www.python.org/downloads/windows/' -UseBasicParsing -TimeoutSec 60).Content
    $matchesFound = [regex]::Matches($html, 'https://www\.python\.org/ftp/python/(3\.14\.\d+)/python-\1-amd64\.exe')
    $chosen = $matchesFound | Sort-Object { [version]$_.Groups[1].Value } -Descending | Select-Object -First 1
    if (-not $chosen) { throw 'No se encontro instalador Python 3.14 x64 en python.org. Reintentar o revisar la guia.' }
    return $chosen.Value
}
function Get-PostgresArchive {
    $html = (Invoke-WebRequest 'https://www.enterprisedb.com/download-postgresql-binaries' -UseBasicParsing -TimeoutSec 60).Content
    # The official EDB page links current downloads via file IDs, followed by architecture labels.
    $match = [regex]::Match($html, 'Version\s*(?:<!--.*?-->\s*)?18\.\d+</span>.*?href="(https://sbp\.enterprisedb\.com/getfile\.jsp\?fileid=\d+)"[^>]*><img alt="Windows x86-64"', 'Singleline')
    if (-not $match.Success) { throw 'No se encontro el archivo oficial PostgreSQL 18 x64. Reintentar o revisar la guia.' }
    $head = Invoke-WebRequest $match.Groups[1].Value -Method Head -UseBasicParsing -TimeoutSec 60
    $url = $head.BaseResponse.ResponseUri.AbsoluteUri
    if ($url -notmatch '^https://get\.enterprisedb\.com/postgresql/postgresql-18\.\d+-\d+-windows-x64-binaries\.zip$') {
        throw 'La descarga PostgreSQL no coincide con el origen oficial esperado.'
    }
    return $url
}
function Download-Official([string]$url, [string]$file) {
    Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing -TimeoutSec 1800
    if ((Get-Item -LiteralPath $file).Length -lt 10000) { throw 'Descarga incompleta.' }
}
function Assert-Publisher([string]$file, [string]$publisher) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch $publisher) {
        throw 'La firma del instalador no es valida o no corresponde al proveedor esperado. No se ejecutara.'
    }
}
function Client-Works([string]$exe) {
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { return $false }
    try { $null = & $exe --version 2>$null; return $LASTEXITCODE -eq 0 } catch { return $false }
}

try {
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
        throw 'Este iniciador necesita Windows 10/11 x64. La instalacion ARM/32 bits requiere preparacion aparte.'
    }
    if ($CheckOnly) {
        [pscustomobject]@{ PythonUrl = Get-PythonInstaller; PostgreSQLUrl = Get-PostgresArchive; Runtime = $runtime; Mode = 'Solo consulta: no instala ni conecta la base' } | Format-List
        exit 0
    }
    Write-Host 'HidroTrack - Preparar y abrir backup' -ForegroundColor Cyan
    Write-Host 'La primera vez se descargan herramientas oficiales. No se instala un servidor PostgreSQL.'
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    # Avoid concurrent installers or two windows sharing installation files.
    try { $lock = [IO.File]::Open((Join-Path $runtime 'setup.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw 'Ya hay otra ventana de backup abierta o preparando herramientas. Cerrala antes de reintentar.' }

    if (-not (Test-Path -LiteralPath $pythonExe)) {
        Write-Host 'Descargando Python con Tkinter y pip (instalacion para este usuario)...'
        $installer = Join-Path $runtime 'python-installer.exe'
        Download-Official (Get-PythonInstaller) $installer
        Assert-Publisher $installer 'Python Software Foundation'
        $arguments = @('/quiet','InstallAllUsers=0',('TargetDir="' + $pythonHome + '"'),'Include_launcher=0','Include_test=0','Include_doc=0','Include_tcltk=1','Include_pip=1','PrependPath=0','Shortcuts=0')
        $process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -notin @(0,3010)) { throw 'Python no completo la instalacion. Reintenta; no se modifico ninguna base.' }
    }
    & $pythonExe -c 'import tkinter, venv; import sys; assert sys.version_info >= (3, 11)'
    if ($LASTEXITCODE -ne 0) { throw 'Python necesita Tkinter y venv. Revisar la instalacion antes de continuar.' }
    if (-not (Test-Path -LiteralPath $venvPython)) {
        & $pythonExe -m venv $venv
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el entorno Python aislado.' }
    }
    & $venvPython -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('cryptography') else 1)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Instalando biblioteca de cifrado en el entorno privado...'
        & $venvPython -m pip install --disable-pip-version-check --index-url https://pypi.org/simple --only-binary=:all: -r (Join-Path $PSScriptRoot 'requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar la biblioteca de cifrado. Revisar Internet y volver a abrir.' }
    }
    & $venvPython -c 'from cryptography.hazmat.primitives.ciphers import Cipher; from cryptography.hazmat.primitives.kdf.scrypt import Scrypt'
    if ($LASTEXITCODE -ne 0) { throw 'La biblioteca de cifrado no paso la comprobacion. Revisar el entorno antes de crear copias.' }
    if (-not (Test-Path -LiteralPath $pgDump) -or -not (Test-Path -LiteralPath $pgRestore)) {
        Write-Host 'Descargando herramientas PostgreSQL oficiales (aprox. 400 MB la primera vez)...'
        $archive = Join-Path $runtime 'postgresql-download.zip'
        Download-Official (Get-PostgresArchive) $archive
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        $stage = Join-Path $runtime ('clients-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $stage | Out-Null
        try {
            foreach ($entry in $zip.Entries) {
                # Extract only the two client executables and their app-local DLLs, never a server or paths from the ZIP.
                if ($entry.FullName -match '^pgsql/bin/([^/]+\.dll|pg_dump\.exe|pg_restore\.exe)$') {
                    $file = Join-Path $stage ([IO.Path]::GetFileName($entry.FullName))
                    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $file, $true)
                }
            }
        } finally { $zip.Dispose() }
        if (-not (Test-Path (Join-Path $stage 'pg_dump.exe')) -or -not (Test-Path (Join-Path $stage 'pg_restore.exe'))) {
            throw 'El ZIP no contiene los clientes esperados. No se ejecutaran archivos incompletos.'
        }
        New-Item -ItemType Directory -Path $clients -Force | Out-Null
        Get-ChildItem -LiteralPath $stage -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $clients $_.Name) -Force }
        Remove-Item -LiteralPath $archive
    }
    if (-not (Client-Works $pgDump) -or -not (Client-Works $pgRestore)) {
        Write-Host 'Preparando runtime Microsoft Visual C++. Windows puede pedir permiso de administrador.'
        $vc = Join-Path $runtime 'vc_redist.x64.exe'
        Download-Official 'https://aka.ms/vs/17/release/vc_redist.x64.exe' $vc
        Assert-Publisher $vc 'Microsoft Corporation'
        $process = Start-Process -FilePath $vc -ArgumentList '/install /quiet /norestart' -Verb RunAs -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -notin @(0,3010,1638)) { throw 'No se pudo completar Visual C++. Reintentar tras aceptar el permiso de Windows.' }
    }
    if (-not (Client-Works $pgDump) -or -not (Client-Works $pgRestore)) { throw 'Los clientes PostgreSQL no arrancan. Revisar dependencias antes de crear copias.' }
    $env:HIDROTRACK_PG_DUMP = $pgDump
    Write-Host 'Preparacion completa. Abriendo la ventana de backup...' -ForegroundColor Green
    & $venvPython (Join-Path $PSScriptRoot 'backup_app.py')
    if ($LASTEXITCODE -ne 0) { throw 'La ventana no pudo iniciarse. Las copias anteriores se conservan.' }
} catch {
    Write-Host ('No completado: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Podes volver a ejecutar Abrir backup. No se modifico ninguna base de datos.'
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
