#!/usr/bin/env sh
set -eu

usage() {
  cat <<EOF
Usage: $0 --registry REGISTRY --tag TAG [options]

Options:
  --registry REGISTRY        Container registry, e.g. ghcr.io/your-org
  --tag TAG                  Image tag to build and deploy
  --namespace NAMESPACE      Kubernetes namespace (default: flekxitask)
  --image-name NAME          Image name (default: frontend-web)
  --deployment-name NAME     Deployment name (default: frontend-web)
  --container-name NAME      Container name (default: frontend-web)
  --help                     Show this help
EOF
}

REGISTRY=''
TAG=''
NAMESPACE='flekxitask'
IMAGE_NAME='frontend-web'
DEPLOYMENT_NAME='frontend-web'
CONTAINER_NAME='frontend-web'

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
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --image-name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --deployment-name)
      DEPLOYMENT_NAME="$2"
      shift 2
      ;;
    --container-name)
      CONTAINER_NAME="$2"
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

if [ -z "$REGISTRY" ] || [ -z "$TAG" ]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
FRONTEND_PATH="$REPO_ROOT/frontend/web"
FRONTEND_MANIFEST_PATH="$REPO_ROOT/k8s/frontend"
INGRESS_MANIFEST_PATH="$REPO_ROOT/k8s/ingress.yaml"

NORMALIZED_REGISTRY=${REGISTRY%/}
IMAGE="$NORMALIZED_REGISTRY/$IMAGE_NAME:$TAG"

echo "Building $IMAGE from $FRONTEND_PATH"
docker build --pull -t "$IMAGE" "$FRONTEND_PATH"

echo "Pushing $IMAGE"
docker push "$IMAGE"

echo "Applying frontend manifests from $FRONTEND_MANIFEST_PATH"
kubectl apply -n "$NAMESPACE" -f "$FRONTEND_MANIFEST_PATH"

echo "Applying ingress manifest $INGRESS_MANIFEST_PATH"
kubectl apply -n "$NAMESPACE" -f "$INGRESS_MANIFEST_PATH"

echo "Updating deployment/$DEPLOYMENT_NAME container $CONTAINER_NAME to $IMAGE"
kubectl set image deployment/"$DEPLOYMENT_NAME" "$CONTAINER_NAME=$IMAGE" -n "$NAMESPACE"

echo "Waiting for rollout to complete"
kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=180s

echo "Current frontend pods"
kubectl get pods -n "$NAMESPACE" -l app=frontend-web

echo "Deployment complete"