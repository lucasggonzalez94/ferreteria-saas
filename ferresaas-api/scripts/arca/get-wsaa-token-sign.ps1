param(
  [string]$WorkDir = "C:\temp\arca-cert",
  [string]$OpenSSLPath = "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
  [string]$CertPath = "C:\temp\arca-cert\arca_homo_cert.crt",
  [string]$KeyPath = "C:\temp\arca-cert\arca_homo_private.key",
  [string]$Service = "wsfe",
  [string]$WsaaUrl = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  [string]$OutputEnvPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-File([string]$PathToFile, [string]$Label) {
  if (-not (Test-Path -Path $PathToFile -PathType Leaf)) {
    throw "$Label no encontrado: $PathToFile"
  }
}

function Get-XmlNodeText([xml]$XmlDoc, [string]$XPath) {
  $node = $XmlDoc.SelectSingleNode($XPath)
  if ($null -eq $node) {
    return $null
  }

  return $node.InnerText
}

if (-not (Test-Path -Path $OpenSSLPath -PathType Leaf)) {
  throw "OpenSSL no encontrado en: $OpenSSLPath"
}

Require-File -PathToFile $CertPath -Label "Certificado"
Require-File -PathToFile $KeyPath -Label "Clave privada"

if (-not (Test-Path -Path $WorkDir -PathType Container)) {
  New-Item -ItemType Directory -Path $WorkDir | Out-Null
}

$generationTime = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:sszzz")
$expirationTime = (Get-Date).AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:sszzz")
$uniqueId = [int][double]::Parse((Get-Date -UFormat %s))

$traXmlPath = Join-Path $WorkDir "tra.xml"
$traCmsPath = Join-Path $WorkDir "tra.cms"
$traB64Path = Join-Path $WorkDir "tra.b64"
$soapRequestPath = Join-Path $WorkDir "wsaa-loginCms-request.xml"
$soapResponsePath = Join-Path $WorkDir "wsaa-loginCms-response.xml"

$traContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>$uniqueId</uniqueId>
    <generationTime>$generationTime</generationTime>
    <expirationTime>$expirationTime</expirationTime>
  </header>
  <service>$Service</service>
</loginTicketRequest>
"@

Set-Content -Path $traXmlPath -Value $traContent -Encoding UTF8

& $OpenSSLPath smime -sign -in $traXmlPath -signer $CertPath -inkey $KeyPath -nodetach -outform DER -out $traCmsPath
& $OpenSSLPath base64 -in $traCmsPath -A -out $traB64Path

$cmsBase64 = (Get-Content -Path $traB64Path -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($cmsBase64)) {
  throw "No se pudo generar el CMS base64 (tra.b64 vacio)."
}

$soapBody = @"
<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>$cmsBase64</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>
"@

Set-Content -Path $soapRequestPath -Value $soapBody -Encoding UTF8

$headers = @{
  "Content-Type" = "text/xml; charset=utf-8"
  "SOAPAction" = "loginCms"
}

$response = Invoke-WebRequest -Uri $WsaaUrl -Method Post -Headers $headers -Body $soapBody
Set-Content -Path $soapResponsePath -Value $response.Content -Encoding UTF8

[xml]$soapXml = $response.Content
$loginCmsReturn = Get-XmlNodeText -XmlDoc $soapXml -XPath "//*[local-name()='loginCmsReturn']"

if ([string]::IsNullOrWhiteSpace($loginCmsReturn)) {
  throw "WSAA no devolvio loginCmsReturn. Revisar $soapResponsePath"
}

[xml]$tokenXml = $loginCmsReturn

$token = Get-XmlNodeText -XmlDoc $tokenXml -XPath "//*[local-name()='token']"
$sign = Get-XmlNodeText -XmlDoc $tokenXml -XPath "//*[local-name()='sign']"
$expiration = Get-XmlNodeText -XmlDoc $tokenXml -XPath "//*[local-name()='expirationTime']"

if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($sign)) {
  throw "WSAA respondio sin token/sign. Revisar $soapResponsePath"
}

Write-Host ""
Write-Host "WSAA OK" -ForegroundColor Green
Write-Host "Servicio: $Service"
Write-Host "Vence: $expiration"
Write-Host ""
Write-Host "ARCA_TOKEN="$token""
Write-Host "ARCA_SIGN="$sign""
Write-Host ""

if (-not [string]::IsNullOrWhiteSpace($OutputEnvPath)) {
  $envContent = @"
ARCA_TOKEN="$token"
ARCA_SIGN="$sign"
"@
  Set-Content -Path $OutputEnvPath -Value $envContent -Encoding UTF8
  Write-Host "Archivo generado: $OutputEnvPath"
}

Write-Host "Request SOAP: $soapRequestPath"
Write-Host "Response SOAP: $soapResponsePath"
