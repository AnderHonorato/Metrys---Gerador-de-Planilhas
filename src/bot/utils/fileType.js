const path = require('path');

function getFileKind(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'image';
  if (['.txt', '.csv', '.zpl', '.epl', '.tspl', '.prn', '.lbl'].includes(ext)) return 'text';
  if (ext === '.xlsx') return 'xlsx';
  return 'unknown';
}

module.exports = { getFileKind };
