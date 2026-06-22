[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Registry,

    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [string]$Namespace = 'flekxitask',
    [string]$ImageName = 'frontend-web',
    [string]$DeploymentName = 'frontend-web',
    [string]$ContainerName = 'frontend-web'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$frontendPath = Join-Path $repoRoot 'frontend/web'
$frontendManifestPath = Join-Path $repoRoot 'k8s/frontend'
$ingressManifestPath = Join-Path $repoRoot 'k8s/ingress.yaml'

$normalizedRegistry = $Registry.TrimEnd('/')
$image = "$normalizedRegistry/$ImageName`:$Tag"

Write-Host "Building $image from $frontendPath"
docker build --pull -t $image $frontendPath

Write-Host "Pushing $image"
docker push $image

Write-Host "Applying frontend manifests from $frontendManifestPath"
kubectl apply -n $Namespace -f $frontendManifestPath

Write-Host "Applying ingress manifest $ingressManifestPath"
kubectl apply -n $Namespace -f $ingressManifestPath

Write-Host "Updating deployment/$DeploymentName container $ContainerName to $image"
kubectl set image deployment/$DeploymentName "$ContainerName=$image" -n $Namespace

Write-Host "Waiting for rollout to complete"
kubectl rollout status deployment/$DeploymentName -n $Namespace --timeout=180s

Write-Host "Current frontend pods"
kubectl get pods -n $Namespace -l app=frontend-web

Write-Host "Deployment complete"