FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install Bun
USER root

# Install Bun using npm
RUN npm install -g bun

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install

# Copy application code
COPY daVinciDownloader.ts ./
COPY biome.jsonc* ./
COPY playwright.config.ts* ./

# Create output directory and set permissions
RUN mkdir -p /app/downloads && chown -R pptruser:pptruser /app

# Switch back to pptruser (the default user from puppeteer image)
USER pptruser

# Default output path inside container
ENV DEFAULT_OUTPUT_PATH="/app/downloads"

# Expose volume mount point
VOLUME ["/app/downloads"]

# Command to run the application
ENTRYPOINT ["bun", "run", "daVinciDownloader.ts"]