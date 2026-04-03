import React from 'react';
import { TransactionForm } from './components/TransactionForm';
import { SettingsModal } from './components/SettingsModal';
import { CalendarView } from './components/CalendarView';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, History, Plus, X, PieChart as PieChartIcon, Settings as SettingsIcon, TrendingDown, MoreHorizontal, ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Transaction, TimeFilter, CurrencyCode, Settings, SortOrder } from './types';
import { CURRENCIES, TRANSLATIONS, EXCHANGE_RATES as MOCK_RATES, APP_VERSION, CATEGORIES } from './constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchLatestVersion } from './utils/version';

const STORAGE_KEY = 'moneyflow_data';
const SETTINGS_KEY = 'moneyflow_settings';

const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  monthlyBudget: 5000,
  budgetCurrency: 'CNY',
  dashboardCurrency: 'CNY',
  theme: 'auto',
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
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('month');
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<Date | null>(null);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('default');
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);

  const t = TRANSLATIONS[settings.language];
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  // Load data and check updates
  React.useEffect(() => {
    // Check for updates on mount
    fetchLatestVersion()
      .then(data => {
        if (data.version !== APP_VERSION) {
          console.log(`[MoneyFlow] New version available: ${data.version}`);
        }
      })
      .catch(() => {});

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
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return list.filter((item) => {
      const d = new Date(item.date);
      switch (filter) {
        case 'today': return d >= today;
        case 'yesterday': return d >= yesterday && d < today;
        case 'week': return d >= startOfWeek;
        case 'month': return d >= startOfMonth;
        case 'year': return d >= startOfYear;
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
    if (editingTransaction) {
      setTransactions(transactions.map((item) => (item.id === transaction.id ? transaction : item)));
      setEditingTransaction(null);
    } else {
      setTransactions([transaction, ...transactions]);
    }
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setTransactions(transactions.filter((item) => item.id !== id));
    setEditingTransaction(null);
    setIsAdding(false);
  };

  const handleImport = (data: Transaction[]) => {
    try {
      const fallbackCategory = CATEGORIES[CATEGORIES.length - 1];
      const hydrated = data.map(t => {
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
      setTransactions(hydrated);
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
          {(['today', 'yesterday', 'week', 'month', 'year', 'calendar'] as TimeFilter[]).map((f) => (
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
                  : t[timeFilter]}
                {t.totalExpense} ({settings.dashboardCurrency})
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-medium text-gray-500">{CURRENCIES[settings.dashboardCurrency].symbol}</span>
                <span className="text-4xl font-bold tracking-tight">
                  {totalInDashboardCurrency.toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2 })}
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
                  <span className="text-gray-400">{t.budgetRemaining}: <span className={budgetRemaining < 0 ? 'text-red-400' : 'text-green-400'}>{CURRENCIES[settings.budgetCurrency].symbol}{budgetRemaining.toLocaleString()}</span></span>
                  <span className="text-gray-500">/ {CURRENCIES[settings.budgetCurrency].symbol}{settings.monthlyBudget.toLocaleString()}</span>
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
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: settings.theme === 'dark' ? '#111827' : '#fff', color: settings.theme === 'dark' ? '#fff' : '#000' }}
                    formatter={(value: number) => [`${CURRENCIES[settings.dashboardCurrency].symbol}${value.toFixed(2)}`, t.amount]}
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
              onClick={() => {
                setIsAdding(false);
                setEditingTransaction(null);
              }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
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
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md h-[90vh] max-h-[800px]"
            >
              <SettingsModal 
                settings={settings} 
                onUpdateSettings={setSettings} 
                onClose={() => setIsSettingsOpen(false)}
                transactions={transactions}
                onImport={handleImport}
                onClear={() => setTransactions([])}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
