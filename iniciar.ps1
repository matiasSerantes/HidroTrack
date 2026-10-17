$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portableNode) { $env:Path = $portableNode.FullName + ';' + $env:Path }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instalá Node.js 24 LTS para iniciar la aplicación.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) { throw 'Primero ejecutá npm ci para instalar las dependencias.' }
npm.cmd run dev
