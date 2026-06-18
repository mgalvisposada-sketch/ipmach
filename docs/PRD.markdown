# Product Requirements Document (PRD): Motor Parts Search Monitoring and Quote Follow-up System

## 1. Introduction

### 1.1 Overview
This PRD outlines a comprehensive monitoring and reporting system for a car parts company that sources motor parts from the US. The system has two primary aims: **monitoring motor parts searches with detailed reports** and **quote follow-up with comprehensive tracking**. The platform provides real-time visibility into search patterns, quote status, and business performance through role-based dashboards and reports.

The system enables inventory searches by reference code, dynamic quoting with client-specific pricing, and extensive monitoring capabilities. It includes a public landing page and restricted access for logged-in users (clients, agents, admins). Key features include comprehensive search tracking, rule-based quote status monitoring, admin dashboard for quote oversight, and detailed reporting for both searches and quotes.

The frontend and backend for user interactions, analytics, and monitoring are built with Next.js using TypeScript (full-stack: pages for UI, API routes for server logic). The Next.js backend uses Prisma ORM for PostgreSQL database operations and requests data from the .NET 9 Stock Service (hosted on IIS with existing SQL Server for products, prices, stock).

### 1.2 Primary Aims
The system has two main objectives that drive all functionality:

**Aim 1: Motor Parts Search Monitoring**
- **Comprehensive Tracking**: Log every search by reference code, user type, timestamp, and stock status
- **Search Analytics**: Monitor search patterns, frequency, and trends across all users
- **Search Reports**: Generate detailed reports on search activity, popular parts, and search behavior
- **Real-time Monitoring**: Provide live dashboards showing current search activity and trends

**Aim 2: Quote Follow-up and Management**
- **Quote Lifecycle Tracking**: Monitor quotes from creation to closure with status updates
- **Quote Analytics**: Track quote performance, conversion rates, and follow-up effectiveness
- **Quote Reports**: Generate comprehensive reports on quote status, agent performance, and business metrics
- **Admin Oversight**: Provide complete visibility into all quotes and their current status

### 1.3 Supporting Objectives
- **Search Functionality**: Enable agents/clients to search inventory by reference code, with client-adjusted pricing
- **Quote Generation**: Create and export quotes as PDFs with integrated search-to-quote workflow
- **Role-based Access**: Provide appropriate dashboards and reports for clients, agents, and admins
- **Data Integration**: Seamlessly connect search data and quote data for comprehensive business intelligence

### 1.4 Scope
- **In Scope**: 
  - **Search Monitoring**: Comprehensive tracking of all searches, search analytics, and search reports
  - **Quote Management**: Quote creation, status tracking, follow-up monitoring, and quote reports
  - **Dashboard & Reports**: Role-based dashboards with search and quote summaries, detailed reporting capabilities
  - **Admin Oversight**: Complete visibility into search patterns and quote status across all users
  - **Data Integration**: Seamless connection between search data and quote data for business intelligence
- **Out of Scope**: Email quote delivery, ERP/CRM integration, advanced ML (use simple rule-based logic), predictive purchasing recommendations.
- **Assumptions**:
  - Existing SQL Server on IIS with Products (Reference, StockQty, BasePriceUSD), Clients (ID, Name, DiscountRate).
  - Simple rule-based logic: Hot (>10 searches in 24h), Warm (3-10 in 7 days), Cold (else); time decay for older searches.
  - COP/USD rates via API (e.g., exchangeratesapi.io), fetched in Next.js API routes.
  - Next.js 14+ with TypeScript, App Router for frontend/backend; Prisma ORM for PostgreSQL; JWT authentication.

### 1.5 Target Users
- **Client**: Search stock, view personal quotes (read-only), access personal search history.
- **Agent**: Search, generate/export quotes (optional client selection), view own dashboards with search and quote summaries.
- **Admin**: Complete oversight of all searches and quotes, access comprehensive reports, manage users, monitor business performance.

## 2. Functional Requirements

### 2.1 Core Features

#### Feature 1: Inventory Search with Comprehensive Monitoring
- **Description**: Users search by reference code; results show stock, client-adjusted price (if client selected), and location. Every search is comprehensively logged for monitoring and reporting purposes.
- **Details**:
  - Input: Reference code (alphanumeric).
  - Output: Grid (Reference, StockQty, Price, Location); checkboxes for quoting (including out-of-stock/non-existent items).
  - Pricing: If client selected, Price = BasePriceUSD * (1 - ClientDiscount); else BasePriceUSD (requested from .NET API).
  - **Comprehensive Logging**: Record search term, timestamp, user type (agent/client session), stock status, user ID, session ID, and search result details to Postgres (via Next.js API route).
  - Unavailable Items: Flag non-existent/no-stock references; allow quoting.
  - Quote Integration: Client selection dropdown and quote generation (PDF export) are integrated into the search page interface.
  - **Real-time Monitoring**: All searches are immediately available for dashboard monitoring and reporting.
- **Roles**: Clients (view results); Agents (search + quote); Admins (full access + monitoring).
- **Tech**: Next.js page for UI; API route proxies request to .NET Stock Service and logs all activity.

#### Feature 2: Quote Management and Follow-up System
- **Description**: Agents generate quotes from search results with comprehensive tracking and follow-up capabilities. Status auto-updates via rule-based logic; export as PDF. Quote creation is integrated into the search page interface.
- **Details**:
  - Input: Selected items (checkboxes from search results), optional client selection.
  - Logic:
    - Calculate total (client-adjusted prices or base, from .NET).
    - Auto-update status (hot/warm/cold) using rule-based logic in Next.js API route (query Postgres logs for frequency/recency).
    - Generate PDF (QuoteID, items, prices, client name if selected, date, basic branding; Spanish COP format) using library (e.g., pdf-lib in Next.js).
    - **Comprehensive Tracking**: Log quote creation, status changes, follow-up activities, and outcomes to Postgres.
  - Output: Downloadable PDF; quote marked "running" until closed (stored in .NET SQL).
  - **Follow-up Monitoring**: Track quote lifecycle, status changes, and business outcomes for reporting.
- **Roles**: Agents (create/export); Clients (view own); Admins (view all, manage, monitor follow-up).
- **Tech**: Integrated into Next.js search page; API route handles logic, requests .NET for quote storage/retrieval, and logs all quote activities.

#### Feature 3: Search Analytics and Insights
- **Description**: Analyze search patterns and provide insights based on search frequency, trends, and user behavior.
- **Details**:
  - Logic (in Next.js API route):
    - Aggregate search data from Postgres by reference code, user type, time period.
    - Identify popular searches, search trends, and user behavior patterns.
    - Track search-to-quote conversion rates and effectiveness.
    - Monitor out-of-stock searches and demand patterns.
  - Output: Search analytics dashboard with trends, popular parts, and user behavior insights.
- **Roles**: Agents/Admins (view); Clients (limited access to own data).

#### Feature 4: Comprehensive Dashboards and Monitoring
- **Description**: Role-based dashboards providing real-time insights into search activity and quote status with comprehensive monitoring capabilities.
- **Details**:
  - **Client Dashboard**: Personal search history, personal quotes, search activity summary.
  - **Agent Dashboard**: Personal search history, own quotes, search-to-quote conversion metrics, performance insights.
  - **Admin Dashboard**: 
    - **Search Monitoring**: Real-time search activity, popular searches, search trends, user behavior patterns
    - **Quote Oversight**: Running quotes table (QuoteID, Status, Client, Items, Agent, Timestamp) with filtering by agent/status/date
    - **Business Intelligence**: Search and quote summaries, conversion rates, performance metrics
    - **Real-time Monitoring**: Live updates of search activity and quote status changes
  - Tech: Next.js pages with server components; API routes fetch from Postgres (analytics) and .NET (quotes); real-time updates.
- **Roles**: Per user type with appropriate access levels; public sees landing page only.

#### Feature 5: Comprehensive Reporting System
- **Description**: Detailed reports on search activity and quote performance, exportable as PDF/CSV.
- **Details**: 
  - **Search Reports**: Search frequency, popular parts, search trends, user behavior analysis
  - **Quote Reports**: Quote status, conversion rates, agent performance, follow-up effectiveness
  - **Combined Reports**: Search-to-quote analysis, business performance metrics, ROI tracking
  - Generated in Next.js API routes querying Postgres and .NET data.
- **Roles**: Agents (own data); Admins (all data with comprehensive business intelligence).

#### Feature 6: Public Frontend
- **Description**: Public landing page for tool overview.
- **Details**:
  - Content: Simple description, login prompt (no user registration).
  - Routes: "/home" (public); others require login (Next.js middleware for auth).

### 2.2 Non-Functional Requirements
- **Performance**: Searches <1s (SQL indexes in .NET); predictions daily in Next.js; currency rates cached hourly.
- **Scalability**: 100+ users; Next.js for frontend/backend; .NET/IIS for inventory; Postgres for analytics.
- **Security**: JWT auth (handled in Next.js); role-based access; encrypt PDFs if sensitive; track sessions.
- **Reliability**: Async logging in Next.js; fallback to base price if no client; robust PDF generation.
- **Deployment**: Vercel/AWS for Next.js; IIS for .NET; cloud-agnostic.

## 3. Architecture Overview
- **Stock Service (.NET 9)**:
  - ASP.NET Core Web API on IIS.
  - SQL Server: Products (Reference, StockQty, BasePriceUSD), Clients (ID, Name, DiscountRate) - **existing tables**.
  - APIs: Search (by reference), product retrieval, pricing adjustments.
  - Receives requests from Next.js backend for inventory data only.
- **Next.js App (Frontend + Backend)**:
  - Full-stack: Pages/App Router for UI (search with integrated quoting, dashboards, public landing); API routes for analytics, logging, report generation.
  - Built with TypeScript for type safety and better development experience.
  - Connects to PostgreSQL for analytics and quotes data using Prisma ORM.
  - Schema: SearchLogs, Quotes, QuoteLogs, UserSessions.
  - Requests to .NET API for inventory/stock data only (e.g., via fetch/axios in API routes).
  - JWT auth middleware; role claims.
- **Data Flow**:
  1. Search → Next.js page → API route → Requests .NET Stock Service (existing SQL Server), applies client pricing, logs to Postgres.
  2. Quote creation → Integrated into search page → Next.js API route → Creates quote in PostgreSQL, generates PDF, logs to Postgres.
  3. Analytics → Next.js API route queries Postgres for search and quote data, generates insights.
  4. Admin dashboard → Next.js page → API route requests PostgreSQL for quotes and analytics data.
- **Integrations**:
  - Currency: COP/USD via API (exchangeratesapi.io) in Next.js API routes.
  - PDF: pdf-lib or react-pdf in Next.js for quotes.
  - Rule-based logic: Implemented in Next.js API routes; extensible to ML.

## 4. Database Schemas
- **SQL Server (Existing Inventory, via .NET)**:
  - **Products**: (ID, Reference, StockQty, BasePriceUSD) - **Already exists**.
  - **Clients**: (ID, Name, DiscountRate, e.g., 0.1 for 10% off) - **Already exists**.
  - **Users**: (ID, Username, Email, PasswordHash, Role, IsActive) - **May need to be created**.
- **PostgreSQL (Analytics & Quotes, via Next.js with Prisma)**:
  - **SearchLogs**: (ID, SearchTerm, Timestamp, HasStock, UserType: 'agent'/'client', SessionID).
  - **Quotes**: (ID, AgentID, ClientID nullable, Items JSON, Status, TotalAmountUSD, PDFPath).
  - **QuoteLogs**: (ID, QuoteID, Status, Timestamp, ClientID nullable).
  - **UserSessions**: (ID, SessionID, UserID, UserType, StartTime, EndTime, SearchCount, QuoteCount).

## 5. Proposed Reports
Comprehensive monitoring and reporting system (generated in Next.js API routes):

### Search Monitoring Reports
1. **Search Activity Report**: Daily/weekly/monthly search frequency by reference code, user type, and time period. Filters: date range, user type, agent.
2. **Popular Parts Report**: Top searched parts with frequency, trends, and search patterns. Segmented by agent/client.
3. **Search Behavior Analysis**: User search patterns, session analysis, and search effectiveness metrics.
4. **Out-of-Stock Search Report**: Parts searched but unavailable, demand patterns, and business opportunities.

### Quote Follow-up Reports
5. **Quote Status Report**: Running quotes with status, age, and follow-up requirements. Filters: agent, status, date range.
6. **Quote Performance Report**: Conversion rates, agent performance, and quote effectiveness metrics.
7. **Quote Lifecycle Report**: Quote creation to closure timeline, follow-up activities, and outcomes.
8. **Business Intelligence Report**: Combined search-to-quote analysis, ROI tracking, and business performance metrics.

## 6. Implementation Notes
- **.NET Stock Service**: EF Core for SQL; expose REST APIs for Next.js consumption.
- **Next.js**: App Router with TypeScript; Prisma ORM for PostgreSQL; axios for .NET requests; NextAuth for JWT; Tailwind for styling; Chart.js for dashboards; integrated search and quote creation interface.
- **Challenges**:
  - Pricing: Next.js proxies .NET requests for client adjustments.
  - Quote Status: Simple rule-based logic in API routes.
  - Currency: Cache in Next.js (e.g., Redis if needed); handle failures.
  - PDF: Server-side generation in API routes for security.

## 7. Success Metrics
- Search response <1s.
- 90% PDF exports error-free.
- Real-time dashboard updates <5s.
- Comprehensive search and quote tracking with 100% data capture.
- Admin dashboard loads in <2s with complete oversight capabilities.
- User feedback: Improved search monitoring (admins), better quote follow-up (agents), actionable business intelligence (management).