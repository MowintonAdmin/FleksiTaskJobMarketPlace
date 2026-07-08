#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

api_base_url=$(json_escape "${VITE_API_BASE_URL:-}")
google_client_id=$(json_escape "${VITE_GOOGLE_CLIENT_ID:-}")

cat <<EOF >/usr/share/nginx/html/runtime-config.js
window.__FLEKSI_CONFIG__ = {
  VITE_API_BASE_URL: "${api_base_url}",
  VITE_GOOGLE_CLIENT_ID: "${google_client_id}"
};
EOF

exec nginx -g 'daemon off;'
