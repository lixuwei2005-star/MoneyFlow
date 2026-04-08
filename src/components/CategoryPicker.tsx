import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES, Category, SubCategory } from '../constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryPickerProps {
  selectedCategory: Category | null;
  selectedSubCategories: SubCategory[];
  onSelectCategory: (category: Category) => void;
  onToggleSubCategory: (subCategory: SubCategory) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  selectedCategory,
  selectedSubCategories,
  onSelectCategory,
  onToggleSubCategory,
}) => {
  const [view, setView] = React.useState<'main' | 'sub'>('main');

  const handleCategoryClick = (category: Category) => {
    onSelectCategory(category);
    setView('sub');
  };

  const handleBack = () => {
    setView('main');
  };

  return (
    <div className="w-full overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
      <AnimatePresence mode="wait">
        {view === 'main' ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-4 gap-4"
          >
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform group-active:scale-90 ${category.color} ${selectedCategory?.id === category.id ? 'ring-4 ring-offset-2 ring-gray-200 dark:ring-gray-700' : ''}`}>
                  <category.icon size={24} />
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{category.name}</span>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="sub"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-gray-50 dark:border-gray-800">
              <button
                onClick={handleBack}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-400 dark:text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {selectedCategory?.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {selectedCategory?.subCategories.map((sub) => {
                const isSelected = selectedSubCategories.some((s) => s.id === sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => onToggleSubCategory(sub)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
