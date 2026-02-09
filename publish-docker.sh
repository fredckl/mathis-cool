# To load in local docker

set -euo pipefail

VERSION_RAW=$(node -p "require('fs').readFileSync('version.js','utf8').match(/__MATHIS_COOL_VERSION__\\s*=\\s*'([^']+)'/)[1]")
VERSION_TAG=${VERSION_RAW#v}

if [ -z "${VERSION_TAG}" ] || ! printf '%s' "${VERSION_TAG}" | grep -Eq '^[0-9]+\.[0-9]+(\.[0-9]+)?$'; then
  echo "Invalid version tag derived from version.js: '${VERSION_RAW}' -> '${VERSION_TAG}'" >&2
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
