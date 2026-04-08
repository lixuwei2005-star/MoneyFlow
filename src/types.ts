import { Category, SubCategory } from './constants';

export type CurrencyCode = 'MYR' | 'CNY' | 'SGD' | 'USD' | 'HKD';
export type Language = 'zh' | 'en';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: CurrencyCode;
  category: any;
  subCategory: any;
  date: string;
  note: string;
  updatedAt?: number;
}

export interface Tombstone {
  id: string;
  deletedAt: number;
}

export interface Settings {
  language: Language;
  monthlyBudget: number;
  budgetCurrency: CurrencyCode;
  dashboardCurrency: CurrencyCode;
  theme: 'light' | 'dark' | 'auto';
  autoCheckUpdate: boolean;
  autoSync?: boolean;
}

export interface SyncStatus {
  lastSyncedAt: number | null;
  syncing: boolean;
}

export type TimeFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'calendar';

export interface CustomRange {
  start: string | null; // ISO date (yyyy-mm-dd)
  end: string | null;   // ISO date (yyyy-mm-dd)
}
export type SortOrder = 'default' | 'amount_desc' | 'amount_asc';
