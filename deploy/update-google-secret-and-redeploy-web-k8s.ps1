[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Registry,

    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$GoogleClientId,

    [string]$GoogleClientSecret = '',
    [string]$Namespace = 'flekxitask',
    [string]$SecretName = 'flekxitask-secrets'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$redeployScript = Join-Path $scriptRoot 'rebuild-redeploy-web-k8s.ps1'

if (-not (Test-Path $redeployScript)) {
    throw "Redeploy script not found at $redeployScript"
}

# Use kubectl patch with a merge strategy so that only GOOGLE_CLIENT_ID (and
# optionally GOOGLE_CLIENT_SECRET) are updated — all other keys in the secret
# (SECRET_KEY, DATABASE_URL, REDIS_URL, etc.) are preserved.
$b64ClientId = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($GoogleClientId))

if ($GoogleClientSecret) {
    $b64ClientSecret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($GoogleClientSecret))
    $patch = "{`"data`":{`"GOOGLE_CLIENT_ID`":`"$b64ClientId`",`"GOOGLE_CLIENT_SECRET`":`"$b64ClientSecret`"}}"
} else {
    $patch = "{`"data`":{`"GOOGLE_CLIENT_ID`":`"$b64ClientId`"}}"
}

Write-Host "Patching secret $SecretName in namespace $Namespace"
kubectl patch secret $SecretName -n $Namespace --type merge --patch $patch

# Both the frontend and backend pods inject env vars at startup time via
# envFrom/secretRef — they must be restarted to pick up the updated secret.
Write-Host 'Restarting frontend deployment to pick up updated secret env'
kubectl rollout restart deployment/frontend-web -n $Namespace
kubectl rollout status deployment/frontend-web -n $Namespace --timeout=120s

Write-Host 'Restarting backend deployment to pick up updated GOOGLE_CLIENT_ID'
kubectl rollout restart deployment/backend -n $Namespace
kubectl rollout status deployment/backend -n $Namespace --timeout=120s

Write-Host 'Rebuilding and redeploying web frontend'
& $redeployScript -Registry $Registry -Tag $Tag -Namespace $Namespace