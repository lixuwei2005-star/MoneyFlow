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
}

export interface Settings {
  language: Language;
  monthlyBudget: number;
  budgetCurrency: CurrencyCode;
  dashboardCurrency: CurrencyCode;
  theme: 'light' | 'dark' | 'auto';
}

export type TimeFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'calendar';
export type SortOrder = 'default' | 'amount_desc' | 'amount_asc';
