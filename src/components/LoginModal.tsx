import React from 'react';
import { motion } from 'motion/react';
import { X, Cloud, User, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onClose: () => void;
  language: 'zh' | 'en';
}

const TXT = {
  zh: {
    title: '云同步登录',
    subtitle: '用一个用户名 + 4-6 位数字密码同步你的数据',
    username: '用户名',
    usernamePlaceholder: '3-20 位字母/数字/下划线',
    pin: '密码（4-6 位数字）',
    pinPlaceholder: '••••',
    login: '登录',
    register: '注册',
    switchToRegister: '没有账号？去注册',
    switchToLogin: '已有账号？去登录',
    loading: '请稍候...',
    invalidUsername: '用户名需 3-20 位字母/数字/下划线',
    invalidPin: '密码需 4-6 位数字',
  },
  en: {
    title: 'Cloud Sync Login',
    subtitle: 'Use a username + 4-6 digit PIN to sync your data',
    username: 'Username',
    usernamePlaceholder: '3-20 letters/digits/_',
    pin: 'PIN (4-6 digits)',
    pinPlaceholder: '••••',
    login: 'Sign In',
    register: 'Sign Up',
    switchToRegister: 'No account? Sign up',
    switchToLogin: 'Have an account? Sign in',
    loading: 'Please wait...',
    invalidUsername: 'Username must be 3-20 letters/digits/_',
    invalidPin: 'PIN must be 4-6 digits',
  },
};

export function LoginModal({ onClose, language }: Props) {
  const t = TXT[language];
  const { login, register } = useAuth();
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setError(t.invalidUsername); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError(t.invalidPin); return; }

    setLoading(true);
    try {
      if (mode === 'login') await login(username, pin);
      else await register(username, pin);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[32px] p-6 shadow-2xl border border-gray-100 dark:border-gray-800"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <X size={18} />
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center">
          <Cloud size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold dark:text-white">{t.title}</h2>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">{t.subtitle}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.username}</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              placeholder={t.usernamePlaceholder}
              autoComplete="username"
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 text-sm dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.pin}</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder={t.pinPlaceholder}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 text-sm tracking-widest dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-sm shadow-lg hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading ? t.loading : (mode === 'login' ? t.login : t.register)}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          {mode === 'login' ? t.switchToRegister : t.switchToLogin}
        </button>
      </form>
    </motion.div>
  );
}
