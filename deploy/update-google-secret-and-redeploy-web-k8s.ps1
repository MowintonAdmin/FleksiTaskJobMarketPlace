[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Registry,

    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$GoogleClientId,

    [string]$GoogleClientSecret = '',
    [string]$Namespace = 'fleksitask',
    [string]$SecretName = 'fleksitask-secrets'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$redeployScript = Join-Path $scriptRoot 'rebuild-redeploy-web-k8s.ps1'

if (-not (Test-Path $redeployScript)) {
    throw "Redeploy script not found at $redeployScript"
}

$secretArgs = @(
    'create', 'secret', 'generic', $SecretName,
    "--from-literal=GOOGLE_CLIENT_ID=$GoogleClientId"
)

if ($GoogleClientSecret) {
    $secretArgs += "--from-literal=GOOGLE_CLIENT_SECRET=$GoogleClientSecret"
}

$secretArgs += @(
    '-n', $Namespace,
    '--dry-run=client',
    '-o', 'yaml'
)

Write-Host "Applying secret $SecretName in namespace $Namespace"
$secretYaml = & kubectl @secretArgs
if (-not $secretYaml) {
    throw 'kubectl did not return secret YAML'
}

$secretYaml | kubectl apply -f -

Write-Host 'Restarting frontend deployment to pick up updated secret env'
kubectl rollout restart deployment/frontend-web -n $Namespace
kubectl rollout status deployment/frontend-web -n $Namespace --timeout=120s

Write-Host 'Rebuilding and redeploying web frontend'
& $redeployScript -Registry $Registry -Tag $Tag -Namespace $Namespace