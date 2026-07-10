FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Set environment variables for Render
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Switch to root to install dependencies properly
USER root

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose port for Express (UptimeRobot)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
