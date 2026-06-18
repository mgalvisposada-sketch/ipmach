# Motor Parts Search Monitoring and Quote Follow-up System

A comprehensive system for monitoring motor parts searches and managing quote follow-ups with real-time analytics and reporting capabilities.

## 🎯 Project Overview

This system provides two main functionalities:
1. **Motor Parts Search Monitoring** - Track all searches, analyze patterns, and generate insights
2. **Quote Follow-up Management** - Manage quotes from creation to closure with status tracking

## 🏗️ Architecture

- **Frontend & Backend**: Next.js 14+ with TypeScript and App Router
- **Database**: PostgreSQL with Prisma ORM (analytics & quotes)
- **External Service**: .NET 9 Stock Service (inventory data)
- **Authentication**: NextAuth.js with JWT
- **Styling**: Tailwind CSS
- **Charts**: Chart.js for analytics visualization

## 📋 Features

### Core Features
- **Search Interface**: Integrated search with real-time results
- **Quote Management**: Create, track, and manage quotes
- **Role-based Access**: Admin, Agent, and Client roles
- **Real-time Dashboards**: Live monitoring of search and quote activities
- **Comprehensive Reporting**: Detailed analytics and business intelligence
- **PDF Generation**: Export quotes and reports as PDFs

### Analytics & Monitoring
- Search pattern analysis
- Quote performance tracking
- User behavior insights
- Business metrics and KPIs
- Real-time activity monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- .NET 9 SDK (for Stock Service)
- OpenAI API Key (for SERVITRACTOR data extraction - optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd motor-parts-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/motor_parts"
   
   # NextAuth
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # OpenAI (for SERVITRACTOR data extraction)
   OPENAI_API_KEY="sk-your-openai-api-key-here"
   
   # Stock Service API (if applicable)
   STOCK_SERVICE_URL="http://localhost:5000"
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with default credentials:
     - **Admin**: `admin` / `password123`
     - **Agent**: `agent1` / `password123`
     - **Client**: `client1` / `password123`

## 📊 Database Schema

### PostgreSQL Tables (Analytics & Quotes)
- **Users**: User management and authentication
- **SearchLogs**: Track all search activities
- **UserSessions**: Monitor user sessions
- **Quotes**: Store quote data and status
- **QuoteLogs**: Track quote lifecycle changes

### SQL Server Tables (External - Stock Service)
- **Products**: Inventory data (existing)
- **Clients**: Client information (existing)

## 🔧 Configuration

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/motor_parts_analytics"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# External Services
STOCK_SERVICE_URL="https://api.stockservice.company.com"
STOCK_SERVICE_API_KEY="your-api-key"

# Currency API
CURRENCY_API_KEY="your-currency-api-key"
```

## 📁 Project Structure

```
motor-parts-system/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── (auth)/         # Authentication pages
│   │   ├── (dashboard)/    # Dashboard pages
│   │   ├── search/         # Search interface
│   │   └── reports/        # Reports pages
│   ├── components/         # React components
│   ├── lib/               # Utilities and configurations
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Helper functions
├── prisma/                # Database schema and migrations
├── docs/                  # Documentation
└── tests/                 # Test files
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📈 Analytics & Reports

### Available Reports
1. **Search Activity Report** - Daily/weekly/monthly search frequency
2. **Popular Parts Report** - Most searched parts with trends
3. **Quote Performance Report** - Conversion rates and agent performance
4. **Business Intelligence Report** - Combined analytics and KPIs

### Dashboard Features
- Real-time search monitoring
- Quote status overview
- Performance metrics
- User activity tracking

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full access to all features and user management
- **Agent**: Search, create quotes, view own analytics
- **Client**: Search, view own quotes and history

### Permissions
- Role-based access control
- Feature-level permissions
- Data access restrictions

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker Deployment
```bash
# Build the image
docker build -t motor-parts-system .

# Run the container
docker run -p 3000:3000 motor-parts-system
```

## 📝 API Documentation

### Core Endpoints
- `GET /api/search` - Search products
- `POST /api/quotes` - Create quotes
- `GET /api/analytics/searches` - Search analytics
- `GET /api/reports/*` - Generate reports
- `GET /api/users` - User management

### External API Integration
- .NET Stock Service for inventory data
- Currency API for exchange rates
- PDF generation for exports
- **Documents API**: Orders are pushed on creation with selling price and cost per line. See [Orders – Documents API Integration](docs/ORDERS_DOCUMENTS_API_INTEGRATION.md) for curl examples to create orders in this app or directly in the other software.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in `/docs`

## 🔄 Updates & Maintenance

### Regular Maintenance Tasks
- Database backups
- Log rotation
- Performance monitoring
- Security updates

### Monitoring
- Application performance
- Database health
- External service availability
- User activity patterns

---

**Built with ❤️ for efficient motor parts management and business intelligence**
