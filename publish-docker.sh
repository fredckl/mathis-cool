# To load in local docker

set -euo pipefail

node scripts/write-version.js

VERSION_TAG=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")

if [ -z "${VERSION_TAG}" ] || ! printf '%s' "${VERSION_TAG}" | grep -Eq '^[0-9]+\.[0-9]+(\.[0-9]+)?$'; then
  echo "Invalid version tag derived from package.json: '${VERSION_TAG}'" >&2
  exit 1
fi

LOCAL_IMAGE="frederickoller/mathis-cool"
REMOTE_IMAGE="dockhub.lieberweiss.com/frederickoller/mathis-cool"

docker buildx build -f Dockerfile.prod --platform linux/amd64 \
  -t "${LOCAL_IMAGE}:latest" \
  -t "${LOCAL_IMAGE}:${VERSION_TAG}" \
  --load .

docker tag "${LOCAL_IMAGE}:latest" "${REMOTE_IMAGE}:latest"
docker tag "${LOCAL_IMAGE}:${VERSION_TAG}" "${REMOTE_IMAGE}:${VERSION_TAG}"

docker push "${REMOTE_IMAGE}:${VERSION_TAG}"
docker push "${REMOTE_IMAGE}:latest"
