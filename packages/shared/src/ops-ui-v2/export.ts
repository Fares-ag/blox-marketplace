export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [keys.join(','), ...data.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
  downloadBlob(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToJSON(data: unknown[], filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
