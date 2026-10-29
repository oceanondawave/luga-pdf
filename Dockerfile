# Lightweight Node.js Web App for Luga PDF
FROM node:20-slim

ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install Pandoc system binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Install npm dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

EXPOSE 7860

CMD ["node", "server.js"]
