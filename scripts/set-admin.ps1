param(
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$Secret,
  [string]$ProjectId = "cusumano-website",
  [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

$body = @{ email = $Email; admin = $true } | ConvertTo-Json
$headers = @{ "x-admin-secret" = $Secret }
$uri = "https://$Region-$ProjectId.cloudfunctions.net/setAdminByEmail"

Write-Host "Granting admin to $Email via $uri" -ForegroundColor Cyan

$response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 5
