const fs = require('fs/promises');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

async function loadPdfJs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function renderPdfPages(filePath, outputDir, progress) {
  const pdfjs = await loadPdfJs();
  const raw = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(raw),
    disableWorker: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  const pages = [];

  progress({ message: `PDF detectado com ${totalPages} pagina(s).`, level: 'info' });

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    progress({ message: `Convertendo pagina ${pageNumber}/${totalPages}.`, level: 'info' });
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.7 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const canvasContext = canvas.getContext('2d');

    await page.render({ canvasContext, viewport }).promise;

    const imagePath = path.join(outputDir, `pagina-${String(pageNumber).padStart(4, '0')}.png`);
    await fs.writeFile(imagePath, canvas.toBuffer('image/png'));
    pages.push({ pageNumber, imagePath });
  }

  return { totalPages, pages };
}

module.exports = { renderPdfPages };
