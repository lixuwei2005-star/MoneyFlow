import React from 'react';
import { Category, SubCategory, CURRENCIES, TRANSLATIONS } from '../constants';
import { CurrencyCode, Transaction, Language } from '../types';
import { CategoryPicker } from './CategoryPicker';
import { NumberPad } from './NumberPad';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Tag, FileText, Globe, Trash2 } from 'lucide-react';

interface TransactionFormProps {
  onSave: (t: Transaction) => void;
  onDelete?: (id: string) => void;
  onSaveSuccess?: () => void;
  initialData?: Transaction | null;
  language?: Language;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  onSave,
  onDelete,
  onSaveSuccess,
  initialData,
  language = 'zh'
}) => {
  const t = TRANSLATIONS[language];
  const [amount, setAmount] = React.useState(initialData?.amount.toString() || '0');
  const [currency, setCurrency] = React.useState<CurrencyCode>(initialData?.currency || 'CNY');
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(initialData?.category || null);
  const [selectedSubCategories, setSelectedSubCategories] = React.useState<SubCategory[]>(() => {
    if (!initialData?.subCategory || !initialData?.category) return [];
    const subs: SubCategory[] = initialData.category.subCategories || [];
    // Parse stored subCategory.name (possibly comma-separated from multi-select save)
    const names = String(initialData.subCategory.name || '').split(', ').filter(Boolean);
    const matched = names
      .map((n) => subs.find((s) => s.name === n))
      .filter((s): s is SubCategory => !!s);
    if (matched.length > 0) return matched;
    // Preserve single legacy selection (but not the "default" placeholder)
    if (initialData.subCategory.id && initialData.subCategory.id !== 'default') {
      return [initialData.subCategory];
    }
    return [];
  });
  const [note, setNote] = React.useState(initialData?.note || '');
  const [date, setDate] = React.useState(initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = React.useState('');

  const handleSave = () => {
    if (parseFloat(amount) <= 0 || !selectedCategory) {
      setFormError(t.incompleteForm);
      setTimeout(() => setFormError(''), 2500);
      return;
    }
    setFormError('');

    const subCategoryToSave = selectedSubCategories.length > 0
      ? {
          id: selectedSubCategories.map((s) => s.id).join('+'),
          name: selectedSubCategories.map((s) => s.name).join(', '),
        }
      : {
          id: 'default',
          name: selectedCategory.name,
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

    onSaveSuccess?.();

    if (!initialData) {
      setAmount('0');
      setSelectedCategory(null);
      setSelectedSubCategories([]);
      setNote('');
    }
  };

  const handleDelete = () => {
    if (!initialData) return;
    if (window.confirm(t.confirmDelete)) {
      onDelete?.(initialData.id);
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
                onClick={handleDelete}
                className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <label className="relative flex items-center gap-2 bg-gray-800 dark:bg-gray-900 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors">
            <Calendar size={18} />
            <span>{new Date(date).toLocaleDateString()}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
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
            selectedSubCategories={selectedSubCategories}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              // Clear sub-selections when switching to a different category
              if (cat?.id !== selectedCategory?.id) {
                setSelectedSubCategories([]);
              }
            }}
            onToggleSubCategory={(sub: SubCategory) => {
              setSelectedSubCategories((prev) =>
                prev.some((s) => s.id === sub.id)
                  ? prev.filter((s) => s.id !== sub.id)
                  : [...prev, sub]
              );
            }}
          />
          {selectedSubCategories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${selectedCategory?.color}`}>
                {selectedCategory && <selectedCategory.icon size={14} />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{selectedCategory?.name}</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight truncate">
                  {selectedSubCategories.map((s) => s.name).join(', ')}
                </span>
              </div>
            </motion.div>
          )}
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

      {/* Form error toast */}
      <AnimatePresence>
        {formError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-2xl text-center shadow-lg"
          >
            {formError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Number Pad */}
      <NumberPad value={amount} onChange={setAmount} onConfirm={handleSave} confirmLabel={t.save} />
    </div>
  );
};
