import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

interface ExportButtonProps {
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  label?: string;
}

export default function ExportButton({ onExportPDF, onExportExcel, label = 'Exporter' }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        <Download className="w-4 h-4" />
        {label}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div
            className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-20"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {onExportPDF && (
              <button
                onClick={() => {
                  onExportPDF();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <FileText className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Exporter en PDF
                </span>
              </button>
            )}
            {onExportExcel && (
              <button
                onClick={() => {
                  onExportExcel();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--success)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Exporter en Excel
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
