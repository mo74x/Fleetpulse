# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install ALL dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build the NestJS application
COPY . .
RUN npm run build

# Stage 2: Production Dependencies
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
# Install ONLY production dependencies to keep the image small
RUN npm ci --omit=dev

# Stage 3: Production Image
FROM node:20-alpine AS production

# Set Node to production mode
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy only the compiled code and production dependencies from previous stages
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Run as a non-root user for security
USER node

EXPOSE 3000

CMD ["node", "dist/main"]