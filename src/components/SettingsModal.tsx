import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Language, Transaction, CurrencyCode, SyncStatus } from '../types';
import { TRANSLATIONS, CURRENCIES, APP_VERSION } from '../constants';
import { Globe, DollarSign, Download, Upload, RefreshCw, X, Moon, Sun, Monitor, Trash2, Cloud, CloudOff, LogOut, User as UserIcon } from 'lucide-react';
import { fetchLatestVersion } from '../utils/version';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useAuth } from '../contexts/AuthContext';
import { LoginModal } from './LoginModal';

const isNativePlatform = () => !!(window as any).Capacitor?.isNativePlatform?.();

interface SettingsModalProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onClose: () => void;
  transactions: Transaction[];
  onImport: (transactions: Transaction[], settings?: Partial<Settings>) => void;
  onClear: () => void;
  syncStatus?: SyncStatus;
  onSyncNow?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  settings, 
  onUpdateSettings, 
  onClose, 
  transactions,
  onImport,
  onClear,
  syncStatus,
  onSyncNow,
}) => {
  const t = TRANSLATIONS[settings.language];
  const [isChecking, setIsChecking] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);
  const { isLoggedIn, username, logout } = useAuth();
  const lang = settings.language;

  const formatLastSync = (ts: number | null | undefined) => {
    if (!ts) return lang === 'zh' ? '从未同步' : 'Never';
    const diff = Date.now() - ts;
    if (diff < 60_000) return lang === 'zh' ? '刚刚' : 'just now';
    if (diff < 3600_000) {
      const m = Math.floor(diff / 60_000);
      return lang === 'zh' ? `${m} 分钟前` : `${m}m ago`;
    }
    if (diff < 86400_000) {
      const h = Math.floor(diff / 3600_000);
      return lang === 'zh' ? `${h} 小时前` : `${h}h ago`;
    }
    return new Date(ts).toLocaleString();
  };

  const openUpdateUrl = (url: string) => {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleExport = async () => {
    const backup = {
      version: APP_VERSION,
      exportDate: new Date().toISOString(),
      transactions,
      settings,
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const filename = `moneyflow_backup_${new Date().toISOString().split('T')[0]}.json`;

    if (isNativePlatform()) {
      // Android/iOS: write to cache then share via native share sheet
      try {
        await Filesystem.writeFile({
          path: filename,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({
          title: 'MoneyFlow 备份',
          url: uri,
          dialogTitle: settings.language === 'zh' ? '保存或分享备份文件' : 'Save or share backup',
        });
      } catch (err) {
        if ((err as Error).message?.includes('cancel')) return;
        alert(settings.language === 'zh' ? '导出失败：' + err : 'Export failed: ' + err);
      }
      return;
    }

    // Web/desktop: browser download link
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', filename);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
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

    const confirmMsg = settings.language === 'zh'
      ? '导入将覆盖当前所有数据，是否继续？'
      : 'Import will replace all current data. Continue?';
    if (!window.confirm(confirmMsg)) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          // Old format: plain transactions array
          onImport(json, undefined);
          alert(t.importSuccess);
        } else if (json && Array.isArray(json.transactions)) {
          // New format: { version, exportDate, transactions, settings }
          onImport(json.transactions, json.settings);
          alert(t.importSuccess);
        } else {
          alert(t.importError);
        }
      } catch (err) {
        alert(t.importError);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
        {/* Cloud Sync */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
            <Cloud size={14} />
            <span>{lang === 'zh' ? '云同步' : 'Cloud Sync'}</span>
          </div>

          {isLoggedIn ? (
            <div className="space-y-3">
              {/* User banner */}
              <div className="flex items-center justify-between p-4 bg-gray-900 dark:bg-gray-800 rounded-2xl text-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <UserIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{username}</div>
                    <div className="text-[10px] text-gray-400">
                      {lang === 'zh' ? '上次同步：' : 'Last synced: '}
                      {formatLastSync(syncStatus?.lastSyncedAt)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label="logout"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Sync now */}
              <button
                onClick={onSyncNow}
                disabled={syncStatus?.syncing}
                className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-sm flex items-center justify-center gap-2 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <RefreshCw size={18} className={syncStatus?.syncing ? 'animate-spin' : ''} />
                {syncStatus?.syncing
                  ? (lang === 'zh' ? '同步中...' : 'Syncing...')
                  : (lang === 'zh' ? '立即同步' : 'Sync Now')}
              </button>

              {/* Auto sync toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                <div className="flex flex-col gap-0.5 pr-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {lang === 'zh' ? '启动时自动同步' : 'Auto sync on launch'}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {lang === 'zh' ? '打开应用时自动从云端拉取' : 'Pull from cloud when app opens'}
                  </span>
                </div>
                <button
                  role="switch"
                  aria-checked={!!settings.autoSync}
                  onClick={() => onUpdateSettings({ ...settings, autoSync: !settings.autoSync })}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                    settings.autoSync ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${
                      settings.autoSync
                        ? 'translate-x-[22px] bg-white dark:bg-gray-900'
                        : 'bg-white'
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-sm flex items-center justify-center gap-2 text-gray-900 dark:text-white"
            >
              <CloudOff size={18} />
              {lang === 'zh' ? '登录以启用云同步' : 'Sign in for cloud sync'}
            </button>
          )}
        </div>

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
                  {CURRENCIES[code].name} ({CURRENCIES[code].symbol})
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

        {/* Auto check update toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
          <div className="flex flex-col gap-0.5 pr-3">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{t.autoCheckUpdate}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{t.autoCheckUpdateDesc}</span>
          </div>
          <button
            role="switch"
            aria-checked={settings.autoCheckUpdate}
            onClick={() => onUpdateSettings({ ...settings, autoCheckUpdate: !settings.autoCheckUpdate })}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
              settings.autoCheckUpdate ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${
                settings.autoCheckUpdate
                  ? 'translate-x-[22px] bg-white dark:bg-gray-900'
                  : 'bg-white'
              }`}
            />
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

      <AnimatePresence>
        {showLogin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogin(false)}
              className="absolute inset-0 bg-gray-900/60"
            />
            <div className="relative w-full max-w-md">
              <LoginModal onClose={() => setShowLogin(false)} language={lang} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
