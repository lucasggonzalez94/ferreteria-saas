param(
  [string]$SourceEnvPath = "C:\temp\arca-cert\arca_wsaa.env",
  [string]$TargetEnvPath = "",
  [switch]$SkipBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-EnvValueFromLines([string[]]$Lines, [string]$Key) {
  foreach ($line in $Lines) {
    if ($line -match "^\s*#") {
      continue
    }

    if ($line -match "^\s*$Key\s*=\s*(.*)$") {
      return $matches[1].Trim()
    }
  }

  return $null
}

function Set-Or-AppendEnvValue([System.Collections.Generic.List[string]]$Lines, [string]$Key, [string]$Value) {
  $updated = $false
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    $line = $Lines[$i]
    if ($line -match "^\s*#") {
      continue
    }

    if ($line -match "^\s*$Key\s*=") {
      $Lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $Lines.Add("$Key=$Value") | Out-Null
  }
}

if ([string]::IsNullOrWhiteSpace($TargetEnvPath)) {
  $TargetEnvPath = Join-Path $PSScriptRoot "..\..\.env"
}

if (-not (Test-Path -Path $SourceEnvPath -PathType Leaf)) {
  throw "Archivo de origen no encontrado: $SourceEnvPath"
}

if (-not (Test-Path -Path $TargetEnvPath -PathType Leaf)) {
  throw "Archivo .env de destino no encontrado: $TargetEnvPath"
}

$sourceLines = Get-Content -Path $SourceEnvPath
$targetLines = [System.Collections.Generic.List[string]](Get-Content -Path $TargetEnvPath)

$token = Get-EnvValueFromLines -Lines $sourceLines -Key "ARCA_TOKEN"
$sign = Get-EnvValueFromLines -Lines $sourceLines -Key "ARCA_SIGN"

if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($sign)) {
  throw "No se encontraron ARCA_TOKEN/ARCA_SIGN en el archivo origen: $SourceEnvPath"
}

if (-not $SkipBackup) {
  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  $backupPath = "$TargetEnvPath.bak.$timestamp"
  Copy-Item -Path $TargetEnvPath -Destination $backupPath -Force
  Write-Host "Backup creado: $backupPath"
}

Set-Or-AppendEnvValue -Lines $targetLines -Key "ARCA_TOKEN" -Value $token
Set-Or-AppendEnvValue -Lines $targetLines -Key "ARCA_SIGN" -Value $sign

Set-Content -Path $TargetEnvPath -Value $targetLines -Encoding UTF8

Write-Host "Actualizacion completada en: $TargetEnvPath" -ForegroundColor Green
Write-Host "Se actualizaron: ARCA_TOKEN, ARCA_SIGN"
