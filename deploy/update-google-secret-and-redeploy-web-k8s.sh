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
  --namespace NAMESPACE              Kubernetes namespace (default: fleksitask)
  --secret-name NAME                 Kubernetes secret name (default: fleksitask-secrets)
  --help                             Show this help
EOF
}

REGISTRY=''
TAG=''
GOOGLE_CLIENT_ID=''
GOOGLE_CLIENT_SECRET=''
NAMESPACE='fleksitask'
SECRET_NAME='fleksitask-secrets'

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

echo "Applying secret $SECRET_NAME in namespace $NAMESPACE"

if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  kubectl create secret generic "$SECRET_NAME" \
    --from-literal="GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
    --from-literal="GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" \
    -n "$NAMESPACE" \
    --dry-run=client \
    -o yaml | kubectl apply -f -
else
  kubectl create secret generic "$SECRET_NAME" \
    --from-literal="GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
    -n "$NAMESPACE" \
    --dry-run=client \
    -o yaml | kubectl apply -f -
fi

echo "Restarting frontend deployment to pick up updated secret env"
kubectl rollout restart deployment/frontend-web -n "$NAMESPACE"
kubectl rollout status deployment/frontend-web -n "$NAMESPACE" --timeout=120s

echo "Rebuilding and redeploying web frontend"
"$REDEPLOY_SCRIPT" --registry "$REGISTRY" --tag "$TAG" --namespace "$NAMESPACE"