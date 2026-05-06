const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function preprocessImage(inputPath, outputDir, pageNumber) {
  if (!fs.existsSync(inputPath)) {
    throw new Error('Arquivo nao encontrado: ' + inputPath);
  }

  const outputPath = path.join(outputDir, `ocr-${String(pageNumber).padStart(4, '0')}.png`);

  try {
    const image = sharp(inputPath, { limitInputPixels: false });
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const shouldUpscale = width < 2200;

    let pipeline = image
      .rotate()
      .grayscale()
      .normalize()
      .linear(1.18, -12)
      .sharpen({ sigma: 1.2, m1: 0.9, m2: 2.4 });

    if (shouldUpscale) {
      pipeline = pipeline.resize({ width: Math.round(width * 2.4), withoutEnlargement: false });
    }

    await pipeline.png({ compressionLevel: 9 }).toFile(outputPath);
    return outputPath;
  } catch (erro) {
    throw new Error('Erro ao processar imagem: ' + erro.message);
  }
}

module.exports = { preprocessImage };
