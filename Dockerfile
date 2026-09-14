FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Files normally arrive via the bind-mounted volume (see docker-compose.yml);
# this COPY just seeds the image so `docker run` works standalone too.
COPY . /usr/share/nginx/html

EXPOSE 80
