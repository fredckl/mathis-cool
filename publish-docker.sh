# To load in local docker
docker buildx build -f Dockerfile.prod --platform linux/amd64 -t frederickoller/mathis-cool:latest --load .
docker tag frederickoller/mathis-cool dockhub.lieberweiss.com/frederickoller/mathis-cool:latest
docker push dockhub.lieberweiss.com/frederickoller/mathis-cool:latest
