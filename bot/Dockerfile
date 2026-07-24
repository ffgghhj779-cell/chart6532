FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Set environment variables for Render
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PORT=7860

# Switch to root to install dependencies properly
USER root

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose port for HuggingFace Spaces
EXPOSE 7860

# Switch back to pptruser for security
USER pptruser

# Start the bot
CMD ["npm", "start"]
