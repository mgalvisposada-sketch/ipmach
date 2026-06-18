# Motor Parts Search Monitoring and Quote Follow-up System

A comprehensive system for monitoring motor parts searches and managing quote follow-ups with detailed analytics and reporting capabilities.

## Project Overview

This system consists of **two separate projects**:

1. **Motor Parts System** - Next.js 14+ application for search monitoring and quote management
2. **Stock Service** - .NET 9 Web API for inventory and client management

## Project Structure

```
CIPARCOL/
├── motor-parts-system/          # Next.js Application
├── StockService/                # .NET Stock Service
├── docs/                        # Shared Documentation
├── database/                    # Database Scripts
├── deployment/                  # Deployment Configuration
└── README.md                    # This file
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- .NET 9 SDK
- PostgreSQL 14+
- SQL Server 2019+

### Motor Parts System (Next.js)

```bash
cd motor-parts-system
npm install
npm run dev
```

### Stock Service (.NET)

```bash
cd StockService
dotnet restore
dotnet run
```

## Features

### Motor Parts System
- **Search Monitoring**: Track all motor parts searches with detailed analytics
- **Quote Management**: Create, track, and manage quotes with status updates
- **Role-based Access**: Admin, Agent, and Client dashboards
- **Analytics & Reports**: Comprehensive reporting and business intelligence
- **Real-time Updates**: Live monitoring of search activities and quote status

### Stock Service
- **Inventory Management**: Product catalog with stock tracking
- **Client Management**: Customer database with pricing
- **API Integration**: RESTful API for external system integration
- **Client-specific Pricing**: Custom pricing per client per product

## Documentation

- [Product Requirements Document](docs/PRD.markdown)
- [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)
- [User Histories](docs/USER_HISTORIES.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [API Documentation](docs/API_DOCUMENTATION.md)

## Technology Stack

### Motor Parts System
- **Frontend**: Next.js 14+, React 18+, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Charts**: Chart.js or Recharts
- **PDF Generation**: pdf-lib or react-pdf

### Stock Service
- **Backend**: .NET 9, ASP.NET Core Web API
- **Database**: SQL Server with Entity Framework Core
- **Authentication**: JWT Bearer Tokens
- **Documentation**: Swagger/OpenAPI
- **Testing**: xUnit, Moq

## Development

### Database Setup

1. **SQL Server (Stock Service)**:
   ```bash
   cd database/sql-server
   # Run scripts in order: 01-create-database.sql, 02-create-products-table.sql, etc.
   ```

2. **PostgreSQL (Motor Parts System)**:
   ```bash
   cd motor-parts-system
   npx prisma db push
   npx prisma generate
   ```

### Environment Configuration

Copy the example environment files and configure them:

```bash
# Motor Parts System
cp motor-parts-system/env.example motor-parts-system/.env.local

# Stock Service
cp StockService/.env.example StockService/.env
```

## Deployment

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

## Contributing

1. Follow the established project structure
2. Use meaningful commit messages
3. Write tests for new features
4. Update documentation as needed

## License

This project is proprietary and confidential.
