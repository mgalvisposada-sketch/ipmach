# Docker Deployment Guide for Railway

This guide explains how to deploy the Motor Parts System application to Railway using Docker.

## Prerequisites

- Railway account (sign up at https://railway.app)
- Docker installed locally (for testing)
- Git repository connected to Railway

## Files Created

- `Dockerfile` - Multi-stage Docker build configuration
- `.dockerignore` - Files to exclude from Docker build context
- `railway.json` - Railway-specific configuration
- `next.config.js` - Updated with `output: 'standalone'` for optimized Docker builds

## Railway Deployment Steps

### 1. Connect Repository to Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or your Git provider)
4. Select your repository
5. Railway will automatically detect the Dockerfile

### 2. Configure Environment Variables

In Railway dashboard, add these environment variables:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this automatically if you add a PostgreSQL service)
- `NEXTAUTH_SECRET` - Secret key for NextAuth (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your Railway app URL (e.g., `https://your-app.railway.app`)

**Optional (for external services):**
- `STOCK_SERVICE_URL` - External stock service URL
- `STOCK_SERVICE_API_KEY` - API key for stock service
- `CURRENCY_API_KEY` - Currency conversion API key
- `COSTEX_API_URL` - Costex API endpoint
- `COSTEX_ACCESS_KEY` - Costex access key
- `COSTEX_USER_ID` - Costex user ID
- `COSTEX_PASSWORD` - Costex password
- `COSTEX_CUSTOMER` - Costex customer ID

**For Deep Web Search (optional):**
- `SERVITRACTOR_COOKIES` - Cookies for Servitractor endpoint
- `{ORIGIN_CODE}_COOKIES` - Cookies for other endpoints (e.g., `PARTEQUIPOS_COOKIES`)

### 3. Database Setup

1. Add a PostgreSQL service in Railway
2. Railway will automatically provide the `DATABASE_URL` environment variable
3. The application will run migrations automatically on first deployment

### 4. Deploy

Railway will automatically:
1. Build the Docker image using the Dockerfile
2. Install all dependencies (including Playwright)
3. Build the Next.js application
4. Start the application

### 5. Verify Deployment

1. Check the Railway logs for any errors
2. Visit your Railway app URL
3. Test the deep web search functionality

## Local Docker Testing

Before deploying to Railway, you can test the Docker build locally:

```bash
# Build the Docker image
docker build -t motor-parts-system .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="your-database-url" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  motor-parts-system
```

## Dockerfile Architecture

The Dockerfile uses a multi-stage build:

1. **base** - Base Node.js 20 image
2. **deps** - Installs dependencies and generates Prisma Client
3. **builder** - Builds the Next.js application and installs Playwright browsers
4. **runner** - Final production image with minimal dependencies

## Key Features

- ✅ Optimized multi-stage build
- ✅ Playwright support with Chromium browser
- ✅ System dependencies for Playwright installed
- ✅ Non-root user for security
- ✅ Standalone Next.js output for smaller image size
- ✅ Prisma Client generation
- ✅ Production-ready configuration

## Troubleshooting

### Build Fails

- Check Railway logs for specific errors
- Verify all environment variables are set
- Ensure `package.json` has correct scripts

### Playwright Not Working

- Verify system dependencies are installed (they're in the Dockerfile)
- Check that Playwright browsers are being copied correctly
- Look for errors in the application logs

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Check that PostgreSQL service is running in Railway
- Ensure database migrations have run

### Memory Issues

Railway may require additional memory for Playwright. Consider:
- Upgrading to a higher plan
- Using Railway's resource limits configuration

## Notes

- The Dockerfile installs Chromium only (not all browsers) to reduce image size
- Playwright is loaded dynamically to avoid build-time issues
- The application runs as a non-root user for security
- Cache directories are created with proper permissions

