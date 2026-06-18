# Project Structure: Motor Parts Search Monitoring and Quote Follow-up System

## Table of Contents
1. [Project Overview](#project-overview)
2. [Motor Parts System (Next.js)](#motor-parts-system-nextjs)
3. [Stock Service (.NET)](#stock-service-net)
4. [Database Files](#database-files)
5. [Configuration Files](#configuration-files)
6. [Documentation Files](#documentation-files)
7. [Deployment Files](#deployment-files)

---

## Project Overview

This system consists of **two separate projects**:

1. **Motor Parts System** - Next.js 14+ application for search monitoring and quote management
2. **Stock Service** - .NET 9 Web API for inventory and client management

```
CIPARCOL/
├── motor-parts-system/          # Next.js Application
├── StockService/                # .NET Stock Service
├── docs/                        # Shared Documentation
├── database/                    # Database Scripts
├── deployment/                  # Deployment Configuration
└── README.md                    # Main Project README
```

---

## Motor Parts System (Next.js)

### Root Directory
```
motor-parts-system/
├── package.json
├── package-lock.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local
├── .env.production
├── .env.example
├── .gitignore
├── README.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── src/
```

### Source Directory Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── search-monitoring.tsx
│   │   │   │   ├── quote-oversight.tsx
│   │   │   │   └── performance-metrics.tsx
│   │   │   ├── agent/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── search-history.tsx
│   │   │   │   └── quote-management.tsx
│   │   │   └── client/
│   │   │       ├── page.tsx
│   │   │       ├── search-history.tsx
│   │   │       └── quote-history.tsx
│   │   └── layout.tsx
│   ├── search/
│   │   ├── page.tsx
│   │   ├── search-interface.tsx
│   │   ├── search-results.tsx
│   │   └── quote-creation.tsx
│   ├── quotes/
│   │   └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   ├── users/
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/
│   │   │   │   └── route.ts
│   │   │   └── login/
│   │   │       └── route.ts
│   │   ├── search/
│   │   │   └── route.ts
│   │   ├── quotes/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   └── route.ts
│   │   │   └── [id]/export/
│   │   │       └── route.ts
│   │   ├── analytics/
│   │   │   ├── searches/
│   │   │   │   └── route.ts
│   │   │   ├── quotes/
│   │   │   │   └── route.ts
│   │   │   ├── performance/
│   │   │   │   └── route.ts
│   │   │   └── users/
│   │   │       └── route.ts
│   │   ├── reports/
│   │   │   └── export/
│   │   │       └── route.ts
│   │   ├── users/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   └── currency/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── card.tsx
│   │   ├── modal.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── forms/
│   │   ├── search-form.tsx
│   │   ├── quote-form.tsx
│   │   ├── client-selector.tsx
│   │   └── report-filters.tsx
│   ├── charts/
│   │   ├── search-trends-chart.tsx
│   │   ├── quote-performance-chart.tsx
│   │   ├── popular-parts-chart.tsx
│   │   └── conversion-rate-chart.tsx
│   ├── dashboard/
│   │   ├── admin-dashboard.tsx
│   │   ├── agent-dashboard.tsx
│   │   ├── client-dashboard.tsx
│   │   ├── search-monitoring-widget.tsx
│   │   ├── quote-oversight-widget.tsx
│   │   └── performance-metrics-widget.tsx
│   ├── search/
│   │   ├── search-interface.tsx
│   │   ├── search-results-grid.tsx
│   │   ├── search-item-card.tsx
│   │   └── search-filters.tsx
│   ├── quotes/
│   │   ├── quote-list.tsx
│   │   ├── quote-detail.tsx
│   │   ├── quote-status-badge.tsx
│   │   └── quote-actions.tsx
│   ├── reports/
│   │   ├── report-generator.tsx
│   │   ├── report-filters.tsx
│   │   ├── report-table.tsx
│   │   └── report-export.tsx
│   └── users/
│       └── UserManagement.tsx
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── api.ts
│   ├── utils.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── validators.ts
│   ├── pdf-generator.ts
│   └── currency-api.ts
├── types/
│   ├── index.ts
│   ├── search.ts
│   ├── quote.ts
│   ├── user.ts
│   ├── analytics.ts
│   └── api.ts
├── hooks/
│   ├── useSearch.ts
│   ├── useQuotes.ts
│   ├── useAnalytics.ts
│   ├── useAuth.ts
│   └── useReports.ts
├── middleware.ts
└── utils/
    ├── date-helpers.ts
    ├── number-helpers.ts
    ├── string-helpers.ts
    └── validation-helpers.ts
```

---

## Stock Service (.NET)

### Root Directory
```
StockService/
├── StockService.csproj
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
├── appsettings.Production.json
├── .gitignore
├── README.md
├── StockDbContext.cs
├── Product.cs
├── Client.cs
├── ClientProductPrice.cs
├── ProductDto.cs
├── ClientDto.cs
├── IProductRepository.cs
├── ProductRepository.cs
├── IClientRepository.cs
├── ClientRepository.cs
├── IProductService.cs
├── ProductService.cs
├── IClientService.cs
├── ClientService.cs
├── ProductsController.cs
└── ClientsController.cs
```

### Project Structure Details

**Models:**
- `Product.cs` - Product entity with stock management
- `Client.cs` - Client entity with contact information
- `ClientProductPrice.cs` - Client-specific pricing model

**Data Access:**
- `StockDbContext.cs` - Entity Framework DbContext
- `IProductRepository.cs` / `ProductRepository.cs` - Product data access
- `IClientRepository.cs` / `ClientRepository.cs` - Client data access

**Business Logic:**
- `IProductService.cs` / `ProductService.cs` - Product business logic
- `IClientService.cs` / `ClientService.cs` - Client business logic

**API Controllers:**
- `ProductsController.cs` - Product API endpoints
- `ClientsController.cs` - Client API endpoints

**DTOs:**
- `ProductDto.cs` - Product data transfer objects
- `ClientDto.cs` - Client data transfer objects

---

## Database Files

### SQL Server Scripts (Stock Service)
```
database/
├── sql-server/
│   ├── 01-create-database.sql
│   ├── 02-create-products-table.sql
│   ├── 03-create-clients-table.sql
│   ├── 04-create-client-product-prices.sql
│   ├── 05-create-indexes.sql
│   ├── 06-insert-sample-data.sql
│   └── 07-migrations/
│       ├── 001-initial-schema.sql
│       └── 002-add-client-pricing.sql
```

### PostgreSQL Scripts (Motor Parts System)
```
database/
├── postgresql/
│   ├── 01-create-database.sql
│   ├── 02-prisma-schema.prisma
│   ├── 03-migrations/
│   │   ├── 001-initial-migration.sql
│   │   ├── 002-add-users-table.sql
│   │   ├── 003-add-search-logs.sql
│   │   ├── 004-add-quotes-table.sql
│   │   └── 005-add-analytics-tables.sql
│   └── 04-seed-data.sql
```

---

## Configuration Files

### Motor Parts System Configuration
```
motor-parts-system/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── jest.config.js
```

### Stock Service Configuration
```
StockService/
├── appsettings.json
├── appsettings.Development.json
├── appsettings.Production.json
└── launchSettings.json
```

### Shared Deployment Configuration
```
deployment/
├── docker-compose.yml
├── docker/
│   ├── nextjs/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   ├── dotnet/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── nginx/
│       ├── Dockerfile
│       └── nginx.conf
├── kubernetes/
│   ├── motor-parts-system-deployment.yaml
│   ├── stock-service-deployment.yaml
│   ├── postgresql-deployment.yaml
│   ├── sqlserver-deployment.yaml
│   └── ingress.yaml
└── scripts/
    ├── build.sh
    ├── deploy.sh
    ├── backup.sh
    └── monitoring.sh
```

---

## Documentation Files

### Shared Documentation
```
docs/
├── README.md
├── PRD.markdown
├── TECHNICAL_DOCUMENTATION.md
├── USER_HISTORIES.md
├── PROJECT_STRUCTURE.md
├── API_DOCUMENTATION.md
├── DEPLOYMENT_GUIDE.md
├── DEVELOPMENT_SETUP.md
├── TESTING_GUIDE.md
└── MAINTENANCE_GUIDE.md
```

### API Documentation
```
docs/api/
├── motor-parts-system-api.md
├── stock-service-api.md
├── authentication.md
├── error-codes.md
└── examples/
    ├── search-examples.md
    ├── quote-examples.md
    └── analytics-examples.md
```

---

## Testing Files

### Motor Parts System Tests
```
motor-parts-system/
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── lib/
│   ├── integration/
│   │   ├── api/
│   │   └── pages/
│   ├── e2e/
│   │   ├── search-flow.spec.ts
│   │   ├── quote-flow.spec.ts
│   │   └── admin-flow.spec.ts
│   └── fixtures/
│       ├── search-data.json
│       ├── quote-data.json
│       └── user-data.json
└── __tests__/
    ├── components/
    ├── pages/
    └── utils/
```

### Stock Service Tests
```
StockService/
├── StockService.Tests/
│   ├── Controllers/
│   │   ├── ProductsControllerTests.cs
│   │   └── ClientsControllerTests.cs
│   ├── Services/
│   │   ├── ProductServiceTests.cs
│   │   └── ClientServiceTests.cs
│   ├── Repositories/
│   │   ├── ProductRepositoryTests.cs
│   │   └── ClientRepositoryTests.cs
│   └── Integration/
│       ├── DatabaseTests.cs
│       └── ApiTests.cs
└── test-data/
    ├── products.json
    ├── clients.json
    └── users.json
```

---

## Environment Files

### Motor Parts System Environment
```
motor-parts-system/
├── .env.example
├── .env.development
├── .env.staging
├── .env.production
├── .env.local
└── .env.test
```

### Stock Service Environment
```
StockService/
├── .env.example
├── .env.development
├── .env.staging
└── .env.production
```

---

## Summary of File Categories

### Motor Parts System (Next.js)
- **Pages & Components**: 80+ files
- **API Routes**: 20+ files
- **Configuration**: 10+ files
- **Tests**: 100+ files
- **Total**: ~210 files

### Stock Service (.NET)
- **Models & DTOs**: 5 files
- **Repositories**: 4 files
- **Services**: 4 files
- **Controllers**: 2 files
- **Configuration**: 4 files
- **Tests**: 20+ files
- **Total**: ~40 files

### Shared Infrastructure
- **Database Scripts**: 20+ files
- **Deployment**: 15+ files
- **Documentation**: 15+ files
- **Total**: ~50 files

### **Total Project Files: ~300 files**

---

## Project Dependencies

### Motor Parts System Dependencies
- **Frontend**: Next.js 14+, React 18+, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Charts**: Chart.js or Recharts
- **PDF Generation**: pdf-lib or react-pdf

### Stock Service Dependencies
- **Backend**: .NET 9, ASP.NET Core Web API
- **Database**: SQL Server with Entity Framework Core
- **Authentication**: JWT Bearer Tokens
- **Documentation**: Swagger/OpenAPI
- **Testing**: xUnit, Moq

### Shared Dependencies
- **HTTP Client**: Axios or native fetch
- **Validation**: FluentValidation (.NET), Zod (TypeScript)
- **Logging**: Serilog (.NET), Winston (Node.js)
- **Monitoring**: Application Insights, Prometheus

This structure provides a clear separation between the two projects while maintaining shared documentation and deployment configurations.
