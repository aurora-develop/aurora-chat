/**
 * P1-10: 数据导出/导入工具
 * 聚合所有 localStorage store 为带版本号的 JSON 备份文件
 */

interface BackupData {
  version: number;
  exportedAt: string;
  stores: Record<string, unknown>;
}

const STORE_KEYS = [
  'aurora-chat-storage',
  'aurora-settings',
  'aurora-images-storage',
];

/** 导出所有数据为 JSON 文件下载 */
export function exportBackup(): void {
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    stores: {},
  };

  for (const key of STORE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        data.stores[key] = JSON.parse(raw);
      } catch {
        data.stores[key] = raw;
      }
    }
  }

  // 备份 theme 设置
  const theme = localStorage.getItem('aurora-theme');
  if (theme) data.stores['aurora-theme'] = theme;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aurora-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从 JSON 文件导入数据并刷新页面 */
export function importBackup(file: File): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data: BackupData = JSON.parse(text);

        if (!data.version || !data.stores) {
          resolve({ success: false, message: '无效的备份文件格式' });
          return;
        }

        for (const [key, value] of Object.entries(data.stores)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }

        resolve({ success: true, message: '数据导入成功，页面将刷新...' });
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        resolve({ success: false, message: '备份文件解析失败，请检查文件格式' });
      }
    };
    reader.onerror = () => resolve({ success: false, message: '文件读取失败' });
    reader.readAsText(file);
  });
}
