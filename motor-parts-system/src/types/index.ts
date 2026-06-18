// Core types for the Motor Parts Search Monitoring and Quote Follow-up System

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'agent' | 'client';

export interface Product {
  id: number;
  reference: string;
  stockQty: number;
  basePriceCOP: number;
  location?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: number;
  name: string;
  discountRate: number;
  email?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteItem {
  reference: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  hasStock: boolean;
}

export interface Quote {
  id: number;
  agentId: number;
  clientId?: number;
  items: QuoteItem[];
  status: QuoteStatus;
  totalAmount: number;
  pdfPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteStatus = 'running' | 'hot' | 'warm' | 'cold' | 'closed' | 'cancelled';

export interface SearchLog {
  id: number;
  searchTerm: string;
  timestamp: Date;
  hasStock: boolean;
  userType: UserType;
  sessionId: string;
  userId?: number;
  userAgent?: string;
  ipAddress?: string;
  resultCount: number;
  searchDuration?: number;
}

export type UserType = 'agent' | 'client' | 'admin';

export interface UserSession {
  id: number;
  sessionId: string;
  userId?: number;
  userType: UserType;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  searchCount: number;
  quoteCount: number;
}

export interface QuoteLog {
  id: number;
  quoteId: number;
  status: QuoteStatus;
  timestamp: Date;
  clientId?: number;
  agentId: number;
  totalAmount: number;
  itemCount: number;
  followUpDate?: Date;
  notes?: string;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SearchResponse {
  reference: string;
  stockQty: number;
  basePriceCOP: number;
  clientPriceCOP?: number;
  hasStock: boolean;
  location?: string;
}

export interface SearchRequest {
  reference: string;
  clientId?: number;
}

export interface QuoteRequest {
  agentId: number;
  clientId?: number;
  items: QuoteItem[];
  totalAmount: number;
}

// Dashboard and Analytics types
export interface SearchStats {
  totalSearches: number;
  searchesToday: number;
  searchesThisWeek: number;
  searchesThisMonth: number;
  popularParts: PopularPart[];
  searchTrends: SearchTrend[];
}

export interface PopularPart {
  reference: string;
  searchCount: number;
  hasStock: boolean;
  lastSearched: Date;
}

export interface SearchTrend {
  date: string;
  searchCount: number;
  userType: UserType;
}

export interface QuoteStats {
  totalQuotes: number;
  runningQuotes: number;
  hotQuotes: number;
  warmQuotes: number;
  coldQuotes: number;
  closedQuotes: number;
  conversionRate: number;
  averageValue: number;
}

export interface AgentPerformance {
  agentId: number;
  agentName: string;
  totalQuotes: number;
  conversionRate: number;
  averageValue: number;
  searchCount: number;
}

export interface BusinessMetrics {
  totalRevenue: number;
  totalQuotes: number;
  averageQuoteValue: number;
  topPerformingAgents: AgentPerformance[];
  popularProducts: PopularPart[];
  searchToQuoteRatio: number;
}

// Report types
export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  userType?: UserType;
  agentId?: number;
  clientId?: number;
  status?: QuoteStatus;
}

export interface ReportData {
  searches: SearchLog[];
  quotes: Quote[];
  analytics: BusinessMetrics;
  generatedAt: Date;
}

// Form types
export interface LoginForm {
  username: string;
  password: string;
}

export interface SearchForm {
  reference: string;
  clientId?: number;
}

export interface QuoteForm {
  items: QuoteItem[];
  clientId?: number;
  notes?: string;
}

// Chart data types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

// Error types
export interface AppError {
  message: string;
  code: string;
  status: number;
  details?: any;
}

// Session types
export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  expires: string;
}

// Navigation types
export interface NavigationItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  current?: boolean;
  children?: NavigationItem[];
}

// Client Source Configuration types
export interface ClientSourceConfig {
  sources: Array<{
    originCode: string;
    enabled: boolean;
    profitValue: number; // Divisor value (e.g., 0.6 means price / 0.6)
  }>;
}

// Component props types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export interface ErrorProps extends BaseComponentProps {
  error: AppError;
  onRetry?: () => void;
}
