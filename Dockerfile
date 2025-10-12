FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY package-lock.json* ./
# If package-lock.json not present, npm ci will fail gracefully and fallback to install
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Copy rest of the source
COPY . .

EXPOSE 3000

# Start the server
CMD ["npm", "start"]