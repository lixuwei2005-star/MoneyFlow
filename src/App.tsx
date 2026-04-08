import React from 'react';
import { TransactionForm } from './components/TransactionForm';
import { SettingsModal } from './components/SettingsModal';
import { CalendarView } from './components/CalendarView';
import { ShareReportModal } from './components/ShareReportModal';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, History, Plus, X, PieChart as PieChartIcon, Settings as SettingsIcon, TrendingDown, MoreHorizontal, ArrowDownUp, ArrowUp, ArrowDown, Calendar, Share2 } from 'lucide-react';
import { Transaction, TimeFilter, CurrencyCode, Settings, SortOrder, CustomRange } from './types';
import { CURRENCIES, TRANSLATIONS, EXCHANGE_RATES as MOCK_RATES, APP_VERSION, CATEGORIES } from './constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchLatestVersion } from './utils/version';
import { useAuth } from './contexts/AuthContext';
import { api } from './utils/api';
import { SyncStatus, Tombstone } from './types';

const STORAGE_KEY = 'moneyflow_data';
const SETTINGS_KEY = 'moneyflow_settings';
const TOMBSTONES_KEY = 'moneyflow_tombstones';
const SETTINGS_UPDATED_KEY = 'moneyflow_settings_updated_at';
const LAST_SYNCED_KEY = 'moneyflow_last_synced';
// Keep old key name only for cleanup
const LEGACY_VERSION_KEY = 'moneyflow_local_version';
// Tombstones older than this get pruned during merge
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  monthlyBudget: 0,
  budgetCurrency: 'CNY',
  dashboardCurrency: 'CNY',
  theme: 'auto',
  autoCheckUpdate: true,
};

export default function App() {
  const [transactions, setTransactions] = React.useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved) as any[];
      
      // Fallback category for re-hydration
      const fallbackCategory = CATEGORIES[CATEGORIES.length - 1];

      // Re-hydrate category icons which are lost during JSON serialization
      return parsed.map(t => {
        if (!t || !t.category) return null;
        const category = CATEGORIES.find(c => c.id === t.category.id) || fallbackCategory;
        return {
          ...t,
          category: { 
            ...t.category, 
            icon: category.icon,
            color: t.category.color || category.color,
            name: t.category.name || category.name
          },
          subCategory: t.subCategory || { id: 'default', name: t.category.name || category.name }
        };
      }).filter(Boolean) as Transaction[];
    } catch (e) {
      console.error('Failed to load transactions:', e);
      return [];
    }
  });
  const [settings, setSettings] = React.useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });
  const [exchangeRates, setExchangeRates] = React.useState(MOCK_RATES);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('month');
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<Date | null>(null);
  const [customRange, setCustomRange] = React.useState<CustomRange>(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      start: startOfYear.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  });
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('default');
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);

  const t = TRANSLATIONS[settings.language];
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [toast, setToast] = React.useState('');

  // ---------- Cloud sync (merge-based) ----------
  const { token, isLoggedIn } = useAuth();

  // Cleanup legacy key from old version-based logic
  React.useEffect(() => {
    localStorage.removeItem(LEGACY_VERSION_KEY);
  }, []);

  const [tombstones, setTombstones] = React.useState<Tombstone[]>(() => {
    try {
      const raw = localStorage.getItem(TOMBSTONES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [settingsUpdatedAt, setSettingsUpdatedAt] = React.useState<number>(() => {
    const v = localStorage.getItem(SETTINGS_UPDATED_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  });
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>(() => ({
    lastSyncedAt: (() => {
      const v = localStorage.getItem(LAST_SYNCED_KEY);
      return v ? parseInt(v, 10) || null : null;
    })(),
    syncing: false,
  }));

  // Refs for skipping bumps when applying remote merge
  const skipSettingsStampRef = React.useRef(true);
  const skipDirtyRef = React.useRef(true);
  const dirtyRef = React.useRef(false);
  const didAutoSyncRef = React.useRef(false);
  const syncNowRef = React.useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const isSyncingRef = React.useRef(false);

  // Persist tombstones / settingsUpdatedAt
  React.useEffect(() => {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
  }, [tombstones]);
  React.useEffect(() => {
    localStorage.setItem(SETTINGS_UPDATED_KEY, String(settingsUpdatedAt));
  }, [settingsUpdatedAt]);

  // Stamp settingsUpdatedAt whenever settings changes (skip first render + remote applies)
  React.useEffect(() => {
    if (skipSettingsStampRef.current) {
      skipSettingsStampRef.current = false;
      return;
    }
    setSettingsUpdatedAt(Date.now());
  }, [settings]);

  // Mark dirty whenever local data changes (skip first render + remote applies)
  React.useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
  }, [transactions, tombstones, settings, settingsUpdatedAt]);

  const stripIcons = (txs: Transaction[]) =>
    txs.map((tx) => ({
      ...tx,
      category: tx.category ? { ...tx.category, icon: undefined } : tx.category,
    }));

  const hydrateTransactions = (list: any[]): Transaction[] => {
    const fallbackCategory = CATEGORIES[CATEGORIES.length - 1];
    return (list || []).map((tx: any) => {
      if (!tx || !tx.category) return null;
      const category = CATEGORIES.find((c) => c.id === tx.category.id) || fallbackCategory;
      return {
        ...tx,
        category: {
          ...tx.category,
          icon: category.icon,
          color: tx.category.color || category.color,
          name: tx.category.name || category.name,
        },
        subCategory: tx.subCategory || { id: 'default', name: tx.category.name || category.name },
      };
    }).filter(Boolean) as Transaction[];
  };

  // Merge two payloads: union of transactions by id (newer updatedAt wins),
  // skipping any id present in tombstones; tombstones unioned & pruned;
  // settings: whichever has newer settingsUpdatedAt.
  type Payload = {
    transactions: any[];
    tombstones: Tombstone[];
    settings: Partial<Settings> | null;
    settingsUpdatedAt: number;
  };
  const mergePayloads = (local: Payload, remote: Payload): Payload => {
    // Tombstones union (latest deletedAt per id)
    const tombMap = new Map<string, Tombstone>();
    for (const t of [...remote.tombstones, ...local.tombstones]) {
      const cur = tombMap.get(t.id);
      if (!cur || t.deletedAt > cur.deletedAt) tombMap.set(t.id, t);
    }
    // Prune ancient tombstones
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    const mergedTombstones = Array.from(tombMap.values()).filter((t) => t.deletedAt > cutoff);
    const tombIds = new Set(mergedTombstones.map((t) => t.id));

    // Transactions: union by id, skip tombstoned, prefer newer updatedAt
    const txMap = new Map<string, any>();
    for (const tx of [...remote.transactions, ...local.transactions]) {
      if (!tx?.id || tombIds.has(tx.id)) continue;
      const cur = txMap.get(tx.id);
      const txTs = tx.updatedAt || 0;
      const curTs = cur?.updatedAt || 0;
      if (!cur || txTs >= curTs) txMap.set(tx.id, tx);
    }

    // Settings: newer wins (or fall back to local if neither stamped)
    const localStamp = local.settingsUpdatedAt || 0;
    const remoteStamp = remote.settingsUpdatedAt || 0;
    const useRemote = remoteStamp > localStamp;
    const mergedSettings = useRemote ? remote.settings : local.settings;
    const mergedSettingsStamp = Math.max(localStamp, remoteStamp);

    return {
      transactions: Array.from(txMap.values()),
      tombstones: mergedTombstones,
      settings: mergedSettings,
      settingsUpdatedAt: mergedSettingsStamp,
    };
  };

  const applyMerged = (merged: Payload) => {
    skipDirtyRef.current = true;
    skipSettingsStampRef.current = true;
    setTransactions(hydrateTransactions(merged.transactions));
    setTombstones(merged.tombstones);
    if (merged.settings) {
      setSettings((prev: Settings) => ({ ...prev, ...merged.settings }));
    }
    setSettingsUpdatedAt(merged.settingsUpdatedAt);
  };

  const markSynced = (ts: number) => {
    localStorage.setItem(LAST_SYNCED_KEY, String(ts));
    setSyncStatus({ lastSyncedAt: ts, syncing: false });
    dirtyRef.current = false;
  };

  const syncNow = React.useCallback(async (silent = false) => {
    if (!token) return;
    if (isSyncingRef.current) return; // prevent reentrancy
    isSyncingRef.current = true;
    setSyncStatus((s) => ({ ...s, syncing: true }));
    try {
      // Up to 3 attempts to handle 409 race
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await api.pull(token);
        const remotePayload: Payload = remote.payload
          ? {
              transactions: (remote.payload as any).transactions || [],
              tombstones: (remote.payload as any).tombstones || [],
              settings: (remote.payload as any).settings || null,
              settingsUpdatedAt: (remote.payload as any).settingsUpdatedAt || 0,
            }
          : { transactions: [], tombstones: [], settings: null, settingsUpdatedAt: 0 };

        const localPayload: Payload = {
          transactions: stripIcons(transactions),
          tombstones,
          settings,
          settingsUpdatedAt,
        };

        const merged = mergePayloads(localPayload, remotePayload);

        try {
          const res = await api.push(token, merged as any, remote.version);
          applyMerged(merged);
          markSynced(res.updatedAt);
          if (!silent) showToast(settings.language === 'zh' ? '同步成功 ✓' : 'Synced ✓');
          return;
        } catch (err: any) {
          if (err?.status === 409) {
            // Server has newer version (race) — re-pull and merge again
            lastErr = err;
            continue;
          }
          throw err;
        }
      }
      throw lastErr || new Error('sync conflict');
    } catch (err: any) {
      setSyncStatus((s) => ({ ...s, syncing: false }));
      if (!silent) {
        alert((settings.language === 'zh' ? '同步失败：' : 'Sync failed: ') + (err?.message || err));
      } else {
        console.warn('[sync] silent fail', err);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [token, transactions, tombstones, settings, settingsUpdatedAt]);

  // Auto sync on launch (once per mount). Always runs once when logged in,
  // regardless of autoSync — pulling cloud data on launch is the safest default
  // when the user is signed in. The autoSync toggle now controls debounced uploads.
  React.useEffect(() => {
    if (!isLoggedIn || didAutoSyncRef.current) return;
    didAutoSyncRef.current = true;
    syncNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Keep latest syncNow accessible from refs (for debounce / visibility handlers)
  React.useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  // Debounced auto-upload after edits (5s)
  React.useEffect(() => {
    if (!isLoggedIn || !settings.autoSync) return;
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) syncNowRef.current?.(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [transactions, tombstones, settings, settingsUpdatedAt, isLoggedIn]);

  // Sync on tab hidden / app backgrounded
  React.useEffect(() => {
    if (!isLoggedIn) return;
    const handler = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        syncNowRef.current?.(true);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isLoggedIn]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // Load data and check updates
  React.useEffect(() => {
    // Check for updates on mount only when the user has the auto-check toggle on
    if (settings.autoCheckUpdate) {
      fetchLatestVersion()
        .then(data => {
          if (data.version !== APP_VERSION) {
            console.log(`[MoneyFlow] New version available: ${data.version}`);
            if (!data.updateUrl) return;
            const shouldUpdate = window.confirm(
              `${t.updateFound}: ${data.version}\n${t.updateAction}`
            );
            if (!shouldUpdate) return;
            try {
              const w = window.open(data.updateUrl, '_blank', 'noopener,noreferrer');
              if (!w) window.location.href = data.updateUrl;
            } catch {
              alert(t.updateOpenFailed);
            }
          }
        })
        .catch(() => {});
    }

    // Fetch real-time rates
    fetch('https://open.er-api.com/v6/latest/CNY')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          const newRates: any = {};
          (Object.keys(CURRENCIES) as CurrencyCode[]).forEach(code => {
            if (data.rates[code]) {
              newRates[code] = data.rates[code];
            }
          });
          setExchangeRates(prev => ({ ...prev, ...newRates }));
        }
      })
      .catch(err => console.error('Failed to fetch rates:', err));
  }, []);

  // Theme logic
  React.useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (settings.theme === 'auto') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(settings.theme);
    }
  }, [settings.theme]);

  // Save data
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  React.useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const convertCurrency = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
    if (from === to) return amount;
    // Base is CNY in our rates
    const amountInBase = amount / exchangeRates[from];
    return amountInBase * exchangeRates[to];
  };

  const filterTransactions = (list: Transaction[], filter: TimeFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return list.filter((item) => {
      const d = new Date(item.date);
      switch (filter) {
        case 'today': return d >= today;
        case 'yesterday': return d >= yesterday && d < today;
        case 'week': return d >= startOfWeek;
        case 'month': return d >= startOfMonth;
        case 'custom': {
          if (!customRange.start || !customRange.end) return true;
          const start = new Date(customRange.start);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customRange.end);
          end.setHours(23, 59, 59, 999);
          return d >= start && d <= end;
        }
        case 'calendar': {
          if (!selectedCalendarDate) return true;
          const target = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), selectedCalendarDate.getDate());
          const nextDay = new Date(target);
          nextDay.setDate(target.getDate() + 1);
          return d >= target && d < nextDay;
        }
        default: return true;
      }
    });
  };

  const filteredTransactions = filterTransactions(transactions, timeFilter);

  const displayTransactions = React.useMemo(() => {
    let list = categoryFilter
      ? filteredTransactions.filter(t => t.category?.id === categoryFilter)
      : filteredTransactions;
    if (sortOrder === 'amount_desc') return [...list].sort((a, b) => b.amount - a.amount);
    if (sortOrder === 'amount_asc') return [...list].sort((a, b) => a.amount - b.amount);
    return list;
  }, [filteredTransactions, sortOrder, categoryFilter]);
  
  const totalInDashboardCurrency = filteredTransactions.reduce((acc, curr) => {
    return acc + convertCurrency(curr.amount, curr.currency, settings.dashboardCurrency);
  }, 0);

  // Budget logic using budgetCurrency
  const monthTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  });

  const totalMonthExpenseInBudgetCurrency = monthTransactions.reduce((acc, tx) => {
    return acc + convertCurrency(tx.amount, tx.currency, settings.budgetCurrency);
  }, 0);

  const budgetRemaining = settings.monthlyBudget - totalMonthExpenseInBudgetCurrency;
  const budgetUsagePercent = settings.monthlyBudget > 0 
    ? Math.min(100, (totalMonthExpenseInBudgetCurrency / settings.monthlyBudget) * 100) 
    : 0;

  const chartData = filteredTransactions.reduce((acc, curr) => {
    const amountInDashboard = convertCurrency(curr.amount, curr.currency, settings.dashboardCurrency);
    const existing = acc.find((item) => item.name === curr.category.name);
    if (existing) {
      existing.value += amountInDashboard;
    } else {
      acc.push({ name: curr.category.name, value: amountInDashboard, color: curr.category.color.replace('bg-', '') });
    }
    return acc;
  }, [] as { name: string; value: number; color: string }[]);

  const COLORS = ['#f97316', '#3b82f6', '#ec4899', '#6366f1', '#22c55e', '#a855f7', '#ef4444', '#ca8a04', '#b45309', '#0891b2', '#64748b', '#6b7280'];

  const handleSave = (transaction: Transaction) => {
    const stamped = { ...transaction, updatedAt: Date.now() };
    if (editingTransaction) {
      setTransactions(transactions.map((item) => (item.id === stamped.id ? stamped : item)));
      setEditingTransaction(null);
    } else {
      setTransactions([stamped, ...transactions]);
    }
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setTransactions(transactions.filter((item) => item.id !== id));
    setTombstones((prev: Tombstone[]) => {
      // Replace existing tombstone for the same id (rare) or append
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, { id, deletedAt: Date.now() }];
    });
    setEditingTransaction(null);
    setIsAdding(false);
  };

  const handleImport = (data: Transaction[], importedSettings?: Partial<Settings>) => {
    try {
      const hydrated = hydrateTransactions(data);
      // Stamp imported records that lack updatedAt so merge treats them as fresh
      const now = Date.now();
      const stamped = hydrated.map((tx) => (tx.updatedAt ? tx : { ...tx, updatedAt: now }));
      setTransactions(stamped);
      // Importing replaces local data → clear tombstones so old deletions don't
      // resurrect deleted records from cloud on next sync
      setTombstones([]);
      if (importedSettings) {
        setSettings((prev: Settings) => ({ ...prev, ...importedSettings }));
      }
      setSettingsUpdatedAt(now);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error('Failed to import transactions:', e);
      alert(t.importError);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black font-sans text-gray-900 dark:text-gray-100 flex flex-col items-center p-4 sm:p-8 pb-24 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-gray-900 shadow-lg">
              <Wallet size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-white">{t.appName}</h1>
            <button
              onClick={() => setIsShareOpen(true)}
              className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label={t.shareReport}
            >
              <Share2 size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={settings.dashboardCurrency}
              onChange={(e) => setSettings({ ...settings, dashboardCurrency: e.target.value as CurrencyCode })}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none dark:text-white"
            >
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <SettingsIcon size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </header>

        {/* Time Filters */}
        <div className="flex bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto no-scrollbar">
          {(['today', 'yesterday', 'week', 'month', 'custom', 'calendar'] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setTimeFilter(f);
                if (f === 'calendar' && !selectedCalendarDate) {
                  setSelectedCalendarDate(new Date());
                } else if (f !== 'calendar') {
                  setSelectedCalendarDate(null);
                }
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                timeFilter === f ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {t[f]}
            </button>
          ))}
        </div>

        {/* Custom Range Panel */}
        {timeFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-[32px] p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
              <Calendar size={16} />
              <span className="text-sm">{t.customRange}</span>
            </div>

            {/* Quick presets */}
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'presetThisYear', getRange: () => {
                    const now = new Date();
                    return { start: new Date(now.getFullYear(), 0, 1), end: now };
                  }
                },
                { key: 'presetLastYear', getRange: () => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setFullYear(now.getFullYear() - 1);
                    return { start, end: now };
                  }
                },
                { key: 'presetLastMonth', getRange: () => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setMonth(now.getMonth() - 1);
                    return { start, end: now };
                  }
                },
                { key: 'presetLastWeek', getRange: () => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setDate(now.getDate() - 7);
                    return { start, end: now };
                  }
                },
              ] as const).map(preset => {
                const range = preset.getRange();
                const startStr = range.start.toISOString().split('T')[0];
                const endStr = range.end.toISOString().split('T')[0];
                const isActive = customRange.start === startStr && customRange.end === endStr;
                return (
                  <button
                    key={preset.key}
                    onClick={() => setCustomRange({ start: startStr, end: endStr })}
                    className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      isActive
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t[preset.key]}
                  </button>
                );
              })}
            </div>

            {/* Date range inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.startDate}</span>
                <input
                  type="date"
                  value={customRange.start || ''}
                  max={customRange.end || undefined}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-xs text-gray-800 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.endDate}</span>
                <input
                  type="date"
                  value={customRange.end || ''}
                  min={customRange.start || undefined}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-xs text-gray-800 dark:text-white"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Calendar View */}
        {timeFilter === 'calendar' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <CalendarView 
              transactions={transactions}
              currency={settings.dashboardCurrency}
              exchangeRates={exchangeRates}
              language={settings.language}
              selectedDate={selectedCalendarDate}
              onSelectDate={(date) => {
                setSelectedCalendarDate(date);
              }}
            />
          </motion.div>
        )}

        {/* Balance Card */}
        <div className="bg-gray-900 dark:bg-gray-800 rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="relative z-10 space-y-4">
            <div className="space-y-1">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                {timeFilter === 'calendar' && selectedCalendarDate
                  ? `${selectedCalendarDate.toLocaleDateString()} `
                  : timeFilter === 'custom'
                    ? ''
                    : t[timeFilter]}
                {t.totalExpense} ({settings.dashboardCurrency})
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-medium text-gray-500">{CURRENCIES[settings.dashboardCurrency].symbol}</span>
                <span className="text-4xl font-bold tracking-tight">
                  {totalInDashboardCurrency.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Budget Progress Bar */}
            {settings.monthlyBudget > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>{t.budgetUsage}</span>
                  <span>{budgetUsagePercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetUsagePercent}%` }}
                    className={`h-full rounded-full ${budgetUsagePercent > 90 ? 'bg-red-500' : budgetUsagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-400">{t.budgetRemaining}: <span className={budgetRemaining < 0 ? 'text-red-400' : 'text-green-400'}>{CURRENCIES[settings.budgetCurrency].symbol}{budgetRemaining.toFixed(2)}</span></span>
                  <span className="text-gray-500">/ {CURRENCIES[settings.budgetCurrency].symbol}{settings.monthlyBudget.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart Section */}
        {chartData.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
              <PieChartIcon size={18} />
              <span>{t.structure} ({settings.dashboardCurrency})</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item: any = payload[0];
                      return (
                        <div className="px-3 py-2 rounded-2xl shadow-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.payload?.fill || item.color }} />
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{item.name}</span>
                          </div>
                          <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-0.5">
                            {CURRENCIES[settings.dashboardCurrency].symbol}{Number(item.value).toFixed(2)}
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {chartData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">{item.name}</span>
                  <span className="text-[10px] font-bold ml-auto dark:text-gray-300">{((item.value / totalInDashboardCurrency) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
              <History size={18} />
              <span>{t.recentTransactions}</span>
            </div>
            {/* Sort buttons */}
            <div className="flex gap-1">
              {(['default', 'amount_desc', 'amount_asc'] as SortOrder[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortOrder(s)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    sortOrder === s
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {s === 'default' && <ArrowDownUp size={10} />}
                  {s === 'amount_desc' && <ArrowDown size={10} />}
                  {s === 'amount_asc' && <ArrowUp size={10} />}
                  {t[s === 'default' ? 'sortDefault' : s === 'amount_desc' ? 'sortAmountDesc' : 'sortAmountAsc']}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                categoryFilter === null
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.filterAll}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  categoryFilter === cat.id
                    ? `${cat.color} text-white`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                <cat.icon size={10} />
                {cat.name}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {displayTransactions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-800"
                >
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-700">
                    <Plus size={32} />
                  </div>
                  <p className="text-gray-400 dark:text-gray-600 font-medium">{t.noData}</p>
                </motion.div>
              ) : (
                displayTransactions.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    onClick={() => {
                      setEditingTransaction(item);
                      setIsAdding(true);
                    }}
                    className="bg-white dark:bg-gray-900 p-4 rounded-3xl flex items-center gap-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md active:scale-[0.98] cursor-pointer"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${item.category?.color || 'bg-gray-500'}`}>
                      {item.category?.icon ? (
                        <item.category.icon size={24} />
                      ) : (
                        <MoreHorizontal size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-gray-200">{item.subCategory?.name || item.category?.name || 'Unknown'}</h3>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            {new Date(item.date).toLocaleDateString()} {item.note && `· ${item.note}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-base text-gray-900 dark:text-white block">
                            - {CURRENCIES[item.currency]?.symbol || ''}{item.amount.toFixed(2)}
                          </span>
                          <span className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase">{item.currency}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingTransaction(null);
          setIsAdding(true);
        }}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus size={32} />
      </button>

      {/* Add/Edit Transaction Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => {
                setIsAdding(false);
                setEditingTransaction(null);
              }}
              className="absolute inset-0 bg-gray-900/50"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: 'transform, opacity' }}
              className="relative w-full max-w-md h-[90vh] max-h-[800px]"
            >
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingTransaction(null);
                }}
                className="absolute -top-4 -right-4 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 z-50"
              >
                <X size={20} />
              </button>
              <TransactionForm
                onSave={handleSave}
                onDelete={handleDelete}
                onSaveSuccess={() => showToast(editingTransaction ? t.editSuccess : t.saveSuccess)}
                initialData={editingTransaction}
                language={settings.language}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-gray-900/50"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: 'transform, opacity' }}
              className="relative w-full max-w-md h-[90vh] max-h-[800px]"
            >
              <SettingsModal
                settings={settings}
                onUpdateSettings={setSettings}
                onClose={() => setIsSettingsOpen(false)}
                transactions={transactions}
                onImport={handleImport}
                onClear={() => setTransactions([])}
                syncStatus={syncStatus}
                onSyncNow={() => syncNow(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Report Modal */}
      <AnimatePresence>
        {isShareOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setIsShareOpen(false)}
              className="absolute inset-0 bg-gray-900/50"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: 'transform, opacity' }}
              className="relative w-full max-w-md h-[90vh] max-h-[800px]"
            >
              <ShareReportModal
                transactions={transactions}
                settings={settings}
                exchangeRates={exchangeRates}
                onClose={() => setIsShareOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save success toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-2xl shadow-2xl whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
