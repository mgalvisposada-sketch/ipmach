# Technical Documentation: Motor Parts Search Monitoring and Quote Follow-up System

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schemas](#database-schemas)
4. [API Specifications](#api-specifications)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Services](#backend-services)
7. [Authentication & Authorization](#authentication--authorization)
8. [Data Flow](#data-flow)
9. [Deployment Architecture](#deployment-architecture)
10. [Development Setup](#development-setup)

## System Architecture

### Overview
The system consists of two main components:
1. **Next.js Full-Stack Application** (TypeScript + Prisma)
2. **.NET 9 Stock Service** (ASP.NET Core Web API)

### Architecture Diagram
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   .NET 9 Stock   │    │   PostgreSQL    │
│   (Frontend +   │◄──►│      Service     │    │   (Analytics)   │
│    Backend)     │    │   (IIS Hosted)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   TypeScript    │    │   SQL Server     │    │   Prisma ORM    │
│   Components    │    │   (Inventory)    │    │   (Analytics)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Technology Stack

### Frontend & Backend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Authentication**: NextAuth.js with JWT
- **PDF Generation**: pdf-lib or react-pdf
- **HTTP Client**: Axios
- **State Management**: React hooks + Context API

### Database Layer
- **Analytics Database**: PostgreSQL with Prisma ORM
- **Inventory Database**: SQL Server with Entity Framework Core

### External Services
- **Currency API**: exchangeratesapi.io
- **Deployment**: Vercel/AWS (Next.js), IIS (.NET)

## Database Schemas

### SQL Server Schema (Existing Inventory Database - .NET Service)

> **Note**: The SQL Server database already exists with Products and Clients tables. The .NET service connects to this existing database.

#### Existing Products Table
```sql
-- Existing table structure (already exists)
CREATE TABLE Products (
    ID INT PRIMARY KEY IDENTITY(1,1),
    Reference NVARCHAR(50) NOT NULL UNIQUE,
    StockQty INT NOT NULL DEFAULT 0,
    BasePriceUSD DECIMAL(10,2) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Existing indexes (already exist)
CREATE INDEX IX_Products_Reference ON Products(Reference);
CREATE INDEX IX_Products_StockQty ON Products(StockQty);
```

#### Existing Clients Table
```sql
-- Existing table structure (already exists)
CREATE TABLE Clients (
    ID INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    DiscountRate DECIMAL(5,4) NOT NULL DEFAULT 0.0, -- e.g., 0.1 for 10% off
    Email NVARCHAR(255),
    Phone NVARCHAR(20),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Existing indexes (already exist)
CREATE INDEX IX_Clients_Name ON Clients(Name);
```

#### Users Table (May need to be created)
```sql
-- This table may need to be created if it doesn't exist
CREATE TABLE Users (
    ID INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL DEFAULT 'agent', -- admin, agent, client
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Indexes
CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_Role ON Users(Role);
```

### PostgreSQL Schema (Analytics & Quotes - Next.js with Prisma)

> **Note**: PostgreSQL stores all analytics data (SearchLogs, UserSessions) and Quotes data. The existing SQL Server only contains Products and Clients.

#### Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Analytics Tables
model SearchLogs {
  id          Int      @id @default(autoincrement())
  searchTerm  String   @db.VarChar(100)
  timestamp   DateTime @default(now())
  hasStock    Boolean  @default(false)
  userType    UserType
  sessionId   String   @db.VarChar(100)
  userId      Int?
  userAgent   String?  @db.VarChar(500)
  ipAddress   String?  @db.VarChar(45)
  resultCount Int      @default(0)
  searchDuration Int?  // milliseconds

  @@index([searchTerm])
  @@index([timestamp])
  @@index([userType])
  @@index([userId])
  @@index([sessionId])
}

model UserSessions {
  id          Int      @id @default(autoincrement())
  sessionId   String   @unique @db.VarChar(100)
  userId      Int?
  userType    UserType
  startTime   DateTime @default(now())
  endTime     DateTime?
  isActive    Boolean  @default(true)
  searchCount Int      @default(0)
  quoteCount  Int      @default(0)

  @@index([sessionId])
  @@index([userId])
  @@index([startTime])
}

// Quotes Table (moved from SQL Server to PostgreSQL)
model Quotes {
  id          Int      @id @default(autoincrement())
  agentId     Int      @default(0)
  clientId    Int?     // References existing client in SQL Server
  items       Json     // JSON array of quote items
  status      QuoteStatus @default(running)
  totalAmountUSD Decimal(10,2)
  pdfPath     String?  @db.VarChar(500)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([agentId])
  @@index([clientId])
  @@index([status])
  @@index([createdAt])
}

model QuoteLogs {
  id          Int      @id @default(autoincrement())
  quoteId     Int      @unique
  status      QuoteStatus
  timestamp   DateTime @default(now())
  clientId    Int?
  agentId     Int      @default(0)
  totalAmount DECIMAL(10,2)
  itemCount   Int      @default(0)
  followUpDate DateTime?
  notes       String?  @db.Text

  @@index([quoteId])
  @@index([status])
  @@index([timestamp])
  @@index([clientId])
  @@index([agentId])
}

enum UserType {
  agent
  client
  admin
}

enum QuoteStatus {
  running
  hot
  warm
  cold
  closed
  cancelled
}
```

## API Specifications

### .NET Stock Service APIs

#### Base URL
```
https://api.stockservice.company.com/api/v1
```

#### Authentication
All APIs require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

#### 1. Search Products API
```http
GET /products/search?reference={reference}&clientId={clientId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "ABC123",
    "stockQty": 50,
    "basePriceUSD": 25.99,
    "clientPriceUSD": 23.39,
    "hasStock": true,
    "location": "Warehouse A"
  }
}
```

#### 2. Get Products API
```http
GET /products?page={page}&limit={limit}&search={search}
```

#### 3. Create Quote API
```http
POST /quotes
Content-Type: application/json

{
  "agentId": 1,
  "clientId": 2,
  "items": [
    {
      "reference": "ABC123",
      "quantity": 5,
      "unitPrice": 25.99
    }
  ],
  "totalAmount": 129.95
}
```

**Note**: Quotes are stored in PostgreSQL, not SQL Server. The .NET service will forward quote creation requests to the Next.js API.

#### 4. Get Running Quotes API
```http
GET /quotes/running?agentId={agentId}&status={status}
```

**Note**: This API will query PostgreSQL via the Next.js API, not directly from SQL Server.

### Next.js API Routes

#### Base URL
```
/api
```

#### 1. Search API
```http
POST /api/search
Content-Type: application/json

{
  "reference": "ABC123",
  "clientId": 2
}
```

#### 2. Analytics API
```http
GET /api/analytics/searches?startDate={date}&endDate={date}&userType={type}
```

#### 3. Quotes API
```http
GET /api/quotes?status={status}&agentId={id}
POST /api/quotes
PUT /api/quotes/{id}/status
```

#### 4. Reports API
```http
GET /api/reports/search-activity?format={pdf|csv}
GET /api/reports/quote-performance?format={pdf|csv}
```

## Frontend Architecture

### Next.js App Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   ├── agent/
│   │   │   └── client/
│   │   └── layout.tsx
│   ├── search/
│   │   └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   ├── search/
│   │   ├── quotes/
│   │   ├── analytics/
│   │   └── reports/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   ├── charts/
│   └── dashboard/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── api.ts
│   └── utils.ts
├── types/
│   └── index.ts
└── hooks/
    └── useSearch.ts
```

### Key Components

#### Search Component
```typescript
// components/SearchInterface.tsx
interface SearchInterfaceProps {
  onSearch: (reference: string) => void;
  onQuoteCreate: (items: QuoteItem[]) => void;
}

interface QuoteItem {
  reference: string;
  quantity: number;
  price: number;
  hasStock: boolean;
}
```

#### Dashboard Components
```typescript
// components/dashboard/AdminDashboard.tsx
interface AdminDashboardProps {
  searchStats: SearchStats;
  quoteStats: QuoteStats;
  recentActivity: ActivityItem[];
}

interface SearchStats {
  totalSearches: number;
  searchesToday: number;
  popularParts: PopularPart[];
}

interface QuoteStats {
  runningQuotes: number;
  hotQuotes: number;
  conversionRate: number;
}
```

## Backend Services

### Next.js API Route Examples

#### Search API Route
```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callStockService } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const { reference, clientId } = await request.json();
    
    // Call .NET Stock Service
    const stockData = await callStockService('/products/search', {
      reference,
      clientId
    });
    
    // Log search to PostgreSQL
    await prisma.searchLogs.create({
      data: {
        searchTerm: reference,
        hasStock: stockData.hasStock,
        userType: 'agent', // Get from session
        sessionId: 'session-id', // Get from session
        resultCount: stockData.resultCount || 0
      }
    });
    
    return NextResponse.json({ success: true, data: stockData });
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

#### Analytics API Route
```typescript
// app/api/analytics/searches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userType = searchParams.get('userType');
    
    const searches = await prisma.searchLogs.findMany({
      where: {
        timestamp: {
          gte: new Date(startDate!),
          lte: new Date(endDate!)
        },
        userType: userType as UserType
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    return NextResponse.json({ success: true, data: searches });
  } catch (error) {
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 });
  }
}
```

## Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@company.com",
  "role": "agent|admin|client",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Role-based Access Control
```typescript
// lib/auth.ts
export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  CLIENT: 'client'
} as const;

export const PERMISSIONS = {
  [ROLES.ADMIN]: ['read:all', 'write:all', 'reports:all'],
  [ROLES.AGENT]: ['read:own', 'write:quotes', 'reports:own'],
  [ROLES.CLIENT]: ['read:own', 'reports:own']
} as const;
```

## Data Flow

### Search Flow
1. User enters reference code in search interface
2. Next.js API route receives search request
3. API route calls .NET Stock Service for product data
4. Product data returned with client-adjusted pricing
5. Search logged to PostgreSQL via Prisma
6. Results displayed to user with quote checkboxes

### Quote Creation Flow
1. User selects items from search results
2. Quote creation triggered in search interface
3. Next.js API route creates quote in PostgreSQL (not .NET service)
4. Quote logged to PostgreSQL for analytics
5. PDF generated and stored
6. Quote status updated based on search patterns

### Analytics Flow
1. All searches and quotes logged to PostgreSQL
2. Analytics API routes query aggregated data
3. Dashboard components fetch real-time analytics
4. Reports generated from aggregated data
5. Admin dashboard shows comprehensive overview

## Deployment Architecture

### Production Environment
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel/AWS    │    │      IIS         │    │   Cloud DB      │
│   (Next.js)     │◄──►│   (.NET API)     │    │  (PostgreSQL)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CDN/Edge      │    │   SQL Server     │    │   Backup/Logs   │
│   (Static)      │    │   (Inventory)    │    │   (Monitoring)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Environment Variables
```env
# Next.js Environment
DATABASE_URL="postgresql://user:pass@host:5432/analytics"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-domain.com"
STOCK_SERVICE_URL="https://api.stockservice.company.com"
CURRENCY_API_KEY="your-currency-api-key"

# .NET Environment
ConnectionStrings__DefaultConnection="Server=...;Database=Inventory;..."
JWT_SECRET="your-jwt-secret"
CORS_ORIGINS="https://your-domain.com"
```

## Development Setup

### Prerequisites
- Node.js 18+
- .NET 9 SDK
- PostgreSQL 14+
- SQL Server 2019+

### Next.js Setup
```bash
# Install dependencies
npm install

# Setup Prisma
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

### .NET Setup
```bash
# Restore packages
dotnet restore

# Run migrations
dotnet ef database update

# Run development server
dotnet run
```

### Database Setup
```bash
# PostgreSQL (Analytics & Quotes)
createdb motor_parts_analytics
npx prisma db push

# SQL Server (Existing Inventory)
# The SQL Server database already exists with Products and Clients tables
# Only create Users table if it doesn't exist
# Use SQL Server Management Studio or Azure Data Studio
```

### Environment Configuration
```bash
# Copy environment files
cp .env.example .env.local
cp .env.example .env.production

# Configure environment variables
# See Environment Variables section above
```

This technical documentation provides comprehensive information for developers to understand and implement the motor parts search monitoring and quote follow-up system.
