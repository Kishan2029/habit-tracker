import { useState } from 'react';
import { exportExcel, exportPDF } from '../../api/exportApi';
import { getLocalDateString, shiftDate } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportButton() {
  const today = getLocalDateString();
  const [start, setStart] = useState(shiftDate(today, -30));
  const [end, setEnd] = useState(today);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState('');

  const handleExport = async (type) => {
    if (new Date(start) > new Date(end)) {
      toast.error('Start date must be before end date');
      return;
    }
    setLoading(type);
    try {
      const exportFn = type === 'xlsx' ? exportExcel : exportPDF;
      const { data } = await exportFn(start, end);
      const ext = type === 'xlsx' ? 'xlsx' : 'pdf';
      const mime = type === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const blob = new Blob([data], { type: mime });
      triggerDownload(blob, `habits-${start}-to-${end}.${ext}`);
      toast.success(`${type === 'xlsx' ? 'Excel' : 'PDF'} exported!`);
      setIsOpen(false);
    } catch {
      toast.error(`Failed to export ${type === 'xlsx' ? 'Excel' : 'PDF'}`);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('xlsx')}
                disabled={!!loading}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50"
              >
                {loading === 'xlsx' ? 'Exporting...' : 'Excel'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!loading}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
              >
                {loading === 'pdf' ? 'Exporting...' : 'PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
