FROM node:22-alpine
WORKDIR /app
COPY api.js mapLinks.js routing.js ./
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "api.js"]
