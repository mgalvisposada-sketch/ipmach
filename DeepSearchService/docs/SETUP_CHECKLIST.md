# Deep Search Service - Setup Checklist

## ✅ Pre-Setup Verification

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm or yarn installed
- [ ] DeepSearchService folder exists in project root

## 📦 Installation

- [ ] Run `npm install` in DeepSearchService directory
- [ ] Verify all dependencies installed (check for errors)

## ⚙️ Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `API_KEY` in `.env` (generate a strong random key)
- [ ] Set `OPENAI_API_KEY` in `.env` (for Servitractor/Retrotrac)
- [ ] Set `PORT` in `.env` (default: 3001)
- [ ] Configure `NEXTJS_API_ORIGIN` if using CORS restrictions

## 🔨 Build

- [ ] Run `npm run build` (compiles TypeScript)
- [ ] Verify `dist/` directory contains compiled files

## 🚀 Start Service

- [ ] Run `npm start` or `npm run dev`
- [ ] Verify service starts without errors
- [ ] Check console for "Deep Search Service running on port 3001"

## 🧪 Testing

- [ ] Test health endpoint: `curl http://localhost:3001/health`
- [ ] Test root endpoint: `curl http://localhost:3001/`
- [ ] Test search endpoint with API key (see QUICKSTART.md)

## 🔗 Next.js Integration

- [ ] Add `DEEP_SEARCH_SERVICE_URL` to Next.js `.env`
- [ ] Add `DEEP_SEARCH_SERVICE_API_KEY` to Next.js `.env`
- [ ] Verify API key matches in both services
- [ ] Test Next.js endpoint calls service successfully

## 🐳 Docker (Optional)

- [ ] Build Docker image: `docker build -t deep-search-service .`
- [ ] Run container: `docker run -p 3001:3001 --env-file .env deep-search-service`
- [ ] Verify service accessible in container

## ❌ Common Issues Fixed

✅ Removed database dependency completely
✅ Removed Playwright, now using Puppeteer
✅ API accepts full endpoint configuration in request body
✅ All endpoint config comes from API request (no database)
✅ Fixed all import paths to use relative paths

## 📝 Notes

- Service has NO database connection - all config comes from API request
- API key must match between Next.js and Deep Search Service
- Service uses Puppeteer with file-based session persistence
- Health endpoint shows Puppeteer session status
- Endpoint configurations must be sent in request body from calling service

