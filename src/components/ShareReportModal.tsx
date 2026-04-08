import React from 'react';
import { motion } from 'motion/react';
import { X, Share2, FileText, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Transaction, CurrencyCode, Settings, CustomRange } from '../types';
import { TRANSLATIONS, CURRENCIES } from '../constants';

const isNativePlatform = () => !!(window as any).Capacitor?.isNativePlatform?.();

interface ShareReportModalProps {
  transactions: Transaction[];
  settings: Settings;
  exchangeRates: Record<CurrencyCode, number>;
  onClose: () => void;
}

type PresetKey = 'presetThisYear' | 'presetLastYear' | 'presetLastMonth' | 'presetLastWeek';

const getPresetRange = (key: PresetKey): { start: string; end: string } => {
  const now = new Date();
  const end = now;
  let start: Date;
  switch (key) {
    case 'presetThisYear':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'presetLastYear':
      start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'presetLastMonth':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    case 'presetLastWeek':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  transactions,
  settings,
  exchangeRates,
  onClose,
}) => {
  const t = TRANSLATIONS[settings.language];
  const [range, setRange] = React.useState<CustomRange>(() => getPresetRange('presetThisYear'));
  const [isGenerating, setIsGenerating] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);

  const convert = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
    if (from === to) return amount;
    const amountInBase = amount / exchangeRates[from];
    return amountInBase * exchangeRates[to];
  };

  const filteredTransactions = React.useMemo(() => {
    if (!range.start || !range.end) return [];
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(23, 59, 59, 999);
    return transactions
      .filter(tx => {
        const d = new Date(tx.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, range]);

  const totalExpense = filteredTransactions.reduce(
    (acc, tx) => acc + convert(tx.amount, tx.currency, settings.dashboardCurrency),
    0
  );

  const categoryBreakdown = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number; count: number }>();
    filteredTransactions.forEach(tx => {
      const key = tx.category.id;
      const amount = convert(tx.amount, tx.currency, settings.dashboardCurrency);
      const existing = map.get(key);
      if (existing) {
        existing.value += amount;
        existing.count += 1;
      } else {
        map.set(key, {
          name: tx.category.name,
          color: tx.category.color || 'bg-gray-500',
          value: amount,
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, settings.dashboardCurrency]);

  const formatAmount = (value: number) =>
    value.toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const symbol = CURRENCIES[settings.dashboardCurrency].symbol;

  // Tailwind bg color → hex map for the report swatches (since html2canvas renders offscreen)
  const colorHex: Record<string, string> = {
    'bg-orange-500': '#f97316',
    'bg-blue-500': '#3b82f6',
    'bg-pink-500': '#ec4899',
    'bg-indigo-500': '#6366f1',
    'bg-green-500': '#22c55e',
    'bg-purple-500': '#a855f7',
    'bg-red-500': '#ef4444',
    'bg-yellow-600': '#ca8a04',
    'bg-amber-700': '#b45309',
    'bg-cyan-600': '#0891b2',
    'bg-slate-500': '#64748b',
    'bg-gray-500': '#6b7280',
  };

  const handleGenerate = async () => {
    if (!reportRef.current || filteredTransactions.length === 0) return;
    setIsGenerating(true);
    try {
      // Temporarily make the report visible off-screen for html2canvas
      const node = reportRef.current;
      node.style.position = 'fixed';
      node.style.left = '0';
      node.style.top = '0';
      node.style.zIndex = '-1';
      node.style.opacity = '1';
      node.style.pointerEvents = 'none';

      const canvas = await html2canvas(node, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        // Tailwind v4 uses oklch() colors which html2canvas can't parse.
        // Inject a stylesheet into the cloned document that forces safe rgb/hex values
        // on any property Tailwind's base layer might set via oklch.
        onclone: (clonedDoc) => {
          const override = clonedDoc.createElement('style');
          override.textContent = `
            *, *::before, *::after {
              border-color: rgb(229, 231, 235) !important;
              text-decoration-color: rgb(156, 163, 175) !important;
            }
            html, body {
              background-color: rgb(255, 255, 255) !important;
              color: rgb(17, 24, 39) !important;
            }
          `;
          clonedDoc.head.appendChild(override);
        },
      });

      // Reset off-screen positioning
      node.style.position = 'absolute';
      node.style.left = '-99999px';
      node.style.top = '0';
      node.style.opacity = '0';

      // JPEG at 0.82 quality is ~10-20x smaller than PNG for text-heavy HTML reports
      // while still being perfectly readable.
      const imgData = canvas.toDataURL('image/jpeg', 0.82);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If taller than one page, split into multiple pages
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const filename = `moneyflow_report_${range.start}_${range.end}.pdf`;

      if (isNativePlatform()) {
        // base64 without the data URI prefix
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({
          title: t.shareReportTitle,
          url: uri,
          dialogTitle: t.shareReport,
        });
      } else {
        pdf.save(filename);
      }
    } catch (err) {
      const msg = (err as Error).message || String(err);
      if (!msg.includes('cancel')) {
        alert((settings.language === 'zh' ? '生成失败: ' : 'Generation failed: ') + msg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const presets: PresetKey[] = ['presetThisYear', 'presetLastYear', 'presetLastMonth', 'presetLastWeek'];

  const isPresetActive = (key: PresetKey) => {
    const r = getPresetRange(key);
    return range.start === r.start && range.end === r.end;
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-white dark:bg-gray-900 shadow-2xl rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-800">
      {/* Header */}
      <div className="p-6 bg-gray-900 dark:bg-black text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Share2 size={20} />
          <h2 className="text-xl font-bold">{t.shareReport}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto no-scrollbar">
        {/* Time Range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            <Calendar size={12} />
            <span>{t.selectTimeRange}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {presets.map(key => (
              <button
                key={key}
                onClick={() => setRange(getPresetRange(key))}
                className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  isPresetActive(key)
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {t[key]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.startDate}</span>
              <input
                type="date"
                value={range.start || ''}
                max={range.end || undefined}
                onChange={(e) => setRange({ ...range, start: e.target.value })}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-xs text-gray-800 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.endDate}</span>
              <input
                type="date"
                value={range.end || ''}
                min={range.start || undefined}
                onChange={(e) => setRange({ ...range, end: e.target.value })}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all text-xs text-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Preview Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-3 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.reportTotalTransactions}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{filteredTransactions.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.reportTotalExpense}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {symbol}{formatAmount(totalExpense)}
            </span>
          </div>
          {filteredTransactions.length === 0 && (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
              {t.noDataInRange}
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-800">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleGenerate}
          disabled={isGenerating || filteredTransactions.length === 0}
          className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t.generating}</span>
            </>
          ) : (
            <>
              <FileText size={18} />
              <span>{t.generatePdf}</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Hidden printable report (rendered off-screen, captured by html2canvas) */}
      <div
        ref={reportRef}
        style={{
          position: 'absolute',
          left: '-99999px',
          top: 0,
          width: '794px', // ~A4 @ 96dpi
          padding: '48px',
          backgroundColor: '#ffffff',
          color: '#111827',
          fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Outfit", "Inter", sans-serif',
          opacity: 0,
        }}
      >
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            MoneyFlow · {t.shareReportTitle}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {t.reportPeriod}: {range.start} — {range.end}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            {t.reportGeneratedAt}: {new Date().toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US')}
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: '16px', padding: '20px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {t.reportTotalExpense} ({settings.dashboardCurrency})
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
              {symbol}{formatAmount(totalExpense)}
            </div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: '16px', padding: '20px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {t.reportTotalTransactions}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
              {filteredTransactions.length}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              {t.reportCategoryBreakdown}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categoryBreakdown.map((cat, idx) => {
                const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colorHex[cat.color] || '#6b7280' }} />
                    <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {cat.count}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', minWidth: '100px', textAlign: 'right' }}>
                      {symbol}{formatAmount(cat.value)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', minWidth: '40px', textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction list */}
        {filteredTransactions.length > 0 && (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              {t.reportTransactionList}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredTransactions.map((tx, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 0',
                    borderBottom: idx === filteredTransactions.length - 1 ? 'none' : '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colorHex[tx.category?.color] || '#6b7280' }} />
                  <div style={{ fontSize: '11px', color: '#9ca3af', width: '90px' }}>
                    {new Date(tx.date).toLocaleDateString(settings.language === 'zh' ? 'zh-CN' : 'en-US')}
                  </div>
                  <div style={{ flex: 1, fontSize: '12px', color: '#111827', fontWeight: 600 }}>
                    {tx.subCategory?.name || tx.category?.name || '-'}
                    {tx.note ? <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {tx.note}</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                    {CURRENCIES[tx.currency]?.symbol || ''}{tx.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', fontSize: '10px', color: '#9ca3af', textAlign: 'center' }}>
          MoneyFlow · Smart Bookkeeping
        </div>
      </div>
    </div>
  );
};
