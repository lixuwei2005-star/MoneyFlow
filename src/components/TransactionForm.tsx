import React from 'react';
import { Category, SubCategory, CURRENCIES, TRANSLATIONS } from '../constants';
import { CurrencyCode, Transaction, Language } from '../types';
import { CategoryPicker } from './CategoryPicker';
import { NumberPad } from './NumberPad';
import { motion } from 'motion/react';
import { Calendar, Tag, FileText, Globe, Trash2 } from 'lucide-react';

interface TransactionFormProps {
  onSave: (t: Transaction) => void;
  onDelete?: (id: string) => void;
  initialData?: Transaction | null;
  language?: Language;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onSave, 
  onDelete, 
  initialData,
  language = 'zh'
}) => {
  const t = TRANSLATIONS[language];
  const [amount, setAmount] = React.useState(initialData?.amount.toString() || '0');
  const [currency, setCurrency] = React.useState<CurrencyCode>(initialData?.currency || 'CNY');
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(initialData?.category || null);
  const [selectedSubCategory, setSelectedSubCategory] = React.useState<SubCategory | null>(initialData?.subCategory || null);
  const [note, setNote] = React.useState(initialData?.note || '');
  const [date, setDate] = React.useState(initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

  const handleSave = () => {
    if (parseFloat(amount) <= 0 || !selectedCategory) {
      return;
    }

    const subCategoryToSave = selectedSubCategory || {
      id: 'default',
      name: selectedCategory.name
    };

    onSave({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      amount: parseFloat(amount),
      currency,
      category: selectedCategory,
      subCategory: subCategoryToSave,
      date: new Date(date).toISOString(),
      note,
    });

    if (!initialData) {
      setAmount('0');
      setSelectedCategory(null);
      setSelectedSubCategory(null);
      setNote('');
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-white dark:bg-gray-900 shadow-2xl rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-800">
      {/* Header / Amount Display */}
      <div className="p-6 pb-4 bg-gray-900 dark:bg-black text-white">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium text-sm">{t.amount}</span>
            {initialData && (
              <button
                onClick={() => onDelete?.(initialData.id)}
                className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-800 dark:bg-gray-900 px-2 py-1 rounded-full text-[10px]">
            <Calendar size={12} />
            <span>{new Date(date).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-medium text-gray-400">{CURRENCIES[currency].symbol}</span>
          <span className="text-4xl font-bold tracking-tight">{amount}</span>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 p-5 space-y-4 overflow-y-auto no-scrollbar">
        {/* Currency Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            <Globe size={12} />
            <span>{t.currency}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <button
                key={code}
                onClick={() => setCurrency(code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  currency === code
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {CURRENCIES[code].name} ({CURRENCIES[code].symbol})
              </button>
            ))}
          </div>
        </div>

        {/* Category Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            <Tag size={12} />
            <span>{t.category}</span>
          </div>
          <CategoryPicker
            selectedCategory={selectedCategory}
            selectedSubCategory={selectedSubCategory}
            onSelectCategory={setSelectedCategory}
            onSelectSubCategory={setSelectedSubCategory}
          />
          {selectedSubCategory && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${selectedCategory?.color}`}>
                {selectedCategory && <selectedCategory.icon size={14} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{selectedCategory?.name}</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">{selectedSubCategory.name}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Date Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            <Calendar size={12} />
            <span>{t.date || '日期'}</span>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-sm text-gray-800 dark:text-white"
          />
        </div>

        {/* Note Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            <FileText size={12} />
            <span>{t.note}</span>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="..."
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-sm text-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Number Pad */}
      <NumberPad value={amount} onChange={setAmount} onConfirm={handleSave} confirmLabel={t.save} />
    </div>
  );
};
