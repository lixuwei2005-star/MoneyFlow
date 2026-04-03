import React from 'react';
import { motion } from 'motion/react';
import { Settings, Language, Transaction, CurrencyCode } from '../types';
import { TRANSLATIONS, CURRENCIES, APP_VERSION } from '../constants';
import { Globe, DollarSign, Download, Upload, RefreshCw, X, Moon, Sun, Monitor, Trash2 } from 'lucide-react';
import { fetchLatestVersion } from '../utils/version';

interface SettingsModalProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onClose: () => void;
  transactions: Transaction[];
  onImport: (data: Transaction[]) => void;
  onClear: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  settings, 
  onUpdateSettings, 
  onClose, 
  transactions,
  onImport,
  onClear
}) => {
  const t = TRANSLATIONS[settings.language];
  const [isChecking, setIsChecking] = React.useState(false);

  const openUpdateUrl = (url: string) => {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const exportFileDefaultName = `moneyflow_backup_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (window.confirm(t.confirmClear)) {
      onClear();
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          onImport(json);
          alert(t.importSuccess);
        }
      } catch (err) {
        alert(t.importError);
      }
    };
    reader.readAsText(file);
  };

  const checkUpdate = async () => {
    setIsChecking(true);
    try {
      const data = await fetchLatestVersion();
      
      setTimeout(() => {
        setIsChecking(false);
        if (data.version !== APP_VERSION) {
          if (!data.updateUrl) {
            alert(`${t.updateLinkMissing}: ${data.version}`);
            return;
          }

          const shouldUpdate = window.confirm(`${t.updateFound}: ${data.version}\n${t.updateAction}`);
          if (!shouldUpdate) return;

          try {
            openUpdateUrl(data.updateUrl);
          } catch {
            alert(t.updateOpenFailed);
          }
        } else {
          alert(t.latestVersion);
        }
      }, 1000);
    } catch (err) {
      setIsChecking(false);
      alert('Check failed: ' + err);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-white dark:bg-gray-900 shadow-2xl rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-800">
      <div className="p-6 bg-gray-900 dark:bg-black text-white flex justify-between items-center">
        <h2 className="text-xl font-bold">{t.settings}</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar">
        {/* Language */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
            <Globe size={14} />
            <span>{t.language}</span>
          </div>
          <div className="flex gap-2">
            {(['zh', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onUpdateSettings({ ...settings, language: lang })}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${
                  settings.language === lang 
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg' 
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                }`}
              >
                {lang === 'zh' ? '简体中文' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
            <Monitor size={14} />
            <span>{t.theme}</span>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'light', icon: Sun, label: t.light },
              { id: 'dark', icon: Moon, label: t.dark },
              { id: 'auto', icon: Monitor, label: t.auto }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onUpdateSettings({ ...settings, theme: item.id as any })}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 ${
                  settings.theme === item.id 
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg' 
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                }`}
              >
                <item.icon size={16} />
                <span className="text-[10px]">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
            <DollarSign size={14} />
            <span>{t.budget}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                <button
                  key={code}
                  onClick={() => onUpdateSettings({ ...settings, budgetCurrency: code })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    settings.budgetCurrency === code
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {CURRENCIES[code].symbol}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={settings.monthlyBudget || ''}
              onChange={(e) => onUpdateSettings({ ...settings, monthlyBudget: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 font-bold text-lg text-gray-900 dark:text-white"
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 px-1 italic">
              {settings.language === 'zh' ? '* 设置为 0 可关闭预算显示' : '* Set to 0 to disable budget display'}
            </p>
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
            <Download size={14} />
            <span>数据管理</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-sm text-gray-900 dark:text-white"
            >
              <Download size={18} />
              {t.export}
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-sm cursor-pointer text-gray-900 dark:text-white">
              <Upload size={18} />
              {t.import}
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <button
            onClick={handleClear}
            className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-bold text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            {t.clearData}
          </button>
        </div>

        {/* Update */}
        <button
          onClick={checkUpdate}
          disabled={isChecking}
          className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-sm flex items-center justify-center gap-2 text-gray-900 dark:text-white"
        >
          <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
          {t.checkUpdate}
        </button>
      </div>
    </div>
  );
};
