#!/usr/bin/env sh
set -eu

usage() {
  cat <<EOF
Usage: $0 --registry REGISTRY --tag TAG --google-client-id CLIENT_ID [options]

Options:
  --registry REGISTRY                Container registry, e.g. ghcr.io/your-org
  --tag TAG                          Image tag to build and deploy
  --google-client-id CLIENT_ID       Google Web OAuth client ID
  --google-client-secret SECRET      Optional Google client secret
  --namespace NAMESPACE              Kubernetes namespace (default: flekxitask)
  --secret-name NAME                 Kubernetes secret name (default: flekxitask-secrets)
  --help                             Show this help
EOF
}

REGISTRY=''
TAG=''
GOOGLE_CLIENT_ID=''
GOOGLE_CLIENT_SECRET=''
NAMESPACE='flekxitask'
SECRET_NAME='flekxitask-secrets'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --google-client-id)
      GOOGLE_CLIENT_ID="$2"
      shift 2
      ;;
    --google-client-secret)
      GOOGLE_CLIENT_SECRET="$2"
      shift 2
      ;;
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --secret-name)
      SECRET_NAME="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$REGISTRY" ] || [ -z "$TAG" ] || [ -z "$GOOGLE_CLIENT_ID" ]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REDEPLOY_SCRIPT="$SCRIPT_DIR/rebuild-redeploy-web-k8s.sh"

if [ ! -f "$REDEPLOY_SCRIPT" ]; then
  echo "Redeploy script not found at $REDEPLOY_SCRIPT" >&2
  exit 1
fi

# Use kubectl patch with a merge strategy so that only GOOGLE_CLIENT_ID (and
# optionally GOOGLE_CLIENT_SECRET) are updated — all other keys in the secret
# (SECRET_KEY, DATABASE_URL, REDIS_URL, etc.) are preserved.
B64_CLIENT_ID=$(printf '%s' "$GOOGLE_CLIENT_ID" | base64 | tr -d '\n')

echo "Patching secret $SECRET_NAME in namespace $NAMESPACE"
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  B64_CLIENT_SECRET=$(printf '%s' "$GOOGLE_CLIENT_SECRET" | base64 | tr -d '\n')
  kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" --type merge \
    --patch "{\"data\":{\"GOOGLE_CLIENT_ID\":\"$B64_CLIENT_ID\",\"GOOGLE_CLIENT_SECRET\":\"$B64_CLIENT_SECRET\"}}"
else
  kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" --type merge \
    --patch "{\"data\":{\"GOOGLE_CLIENT_ID\":\"$B64_CLIENT_ID\"}}"
fi

# Both the frontend and backend pods inject env vars at startup time via
# envFrom/secretRef — they must be restarted to pick up the updated secret.
echo "Restarting frontend deployment to pick up updated secret env"
kubectl rollout restart deployment/frontend-web -n "$NAMESPACE"
kubectl rollout status deployment/frontend-web -n "$NAMESPACE" --timeout=120s

echo "Restarting backend deployment to pick up updated GOOGLE_CLIENT_ID"
kubectl rollout restart deployment/backend -n "$NAMESPACE"
kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=120s

echo "Rebuilding and redeploying web frontend"
"$REDEPLOY_SCRIPT" --registry "$REGISTRY" --tag "$TAG" --namespace "$NAMESPACE"