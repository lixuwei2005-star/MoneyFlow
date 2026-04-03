import React from 'react';
import { Delete } from 'lucide-react';

interface NumberPadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export const NumberPad: React.FC<NumberPadProps> = ({ value, onChange, onConfirm, confirmLabel = '确定' }) => {
  const handlePress = (key: string) => {
    if (key === 'delete') {
      onChange(value.length > 1 ? value.slice(0, -1) : '0');
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      if (value === '0') {
        onChange(key);
      } else {
        if (value.includes('.') && value.split('.')[1].length >= 2) return;
        onChange(value + key);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];

  return (
    <div className="grid grid-cols-4 gap-1.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-t-2xl border-t border-gray-100 dark:border-gray-700">
      <div className="col-span-3 grid grid-cols-3 gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => handlePress(key)}
            className="h-10 flex items-center justify-center bg-white dark:bg-gray-900 rounded-lg text-lg font-semibold text-gray-800 dark:text-gray-200 shadow-sm active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
          >
            {key === 'delete' ? <Delete size={20} /> : key}
          </button>
        ))}
      </div>
      <button
        onClick={onConfirm}
        className="col-span-1 h-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg flex items-center justify-center text-base font-bold shadow-lg active:scale-95 transition-transform"
      >
        {confirmLabel}
      </button>
    </div>
  );
};
