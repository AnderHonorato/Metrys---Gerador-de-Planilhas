const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWorker } = require('tesseract.js');

function getAppPath() {
  return process.resourcesPath ? path.join(process.resourcesPath, 'app') : process.cwd();
}

function downloadTessdata(lang, targetDir) {
  const target = path.join(targetDir, `${lang}.traineddata.gz`);
  if (fs.existsSync(target)) return target;

  const url = `https://tesseract.projectnaptha.com/img/${lang}.traineddata.gz`;
  const temp = target + '.tmp';

  return new Promise(function (resolve, reject) {
    var file = fs.createWriteStream(temp);
    https.get(url, function (res) {
      res.pipe(file);
      file.on('finish', function () {
        file.close();
        fs.renameSync(temp, target);
        resolve(target);
      });
    }).on('error', function (err) {
      fs.unlink(temp, function () {});
      reject(err);
    });
  });
}

async function ensureUnifiedTessdata() {
  const appPath = getAppPath();
  const tessdataDir = path.join(appPath, 'tessdata');

  if (!fs.existsSync(tessdataDir)) {
    fs.mkdirSync(tessdataDir, { recursive: true });
  }

  var todosOk = true;
  var languages = ['por', 'eng'];

  for (var lang of languages) {
    var target = path.join(tessdataDir, lang + '.traineddata.gz');
    if (!fs.existsSync(target)) {
      try {
        console.log('[OCR] Baixando dados para:', lang);
        await downloadTessdata(lang, tessdataDir);
      } catch (e) {
        console.log('[OCR] Erro ao baixar', lang, e.message);
        todosOk = false;
      }
    }
  }

  var hasPor = fs.existsSync(path.join(tessdataDir, 'por.traineddata.gz'));
  var hasEng = fs.existsSync(path.join(tessdataDir, 'eng.traineddata.gz'));

  return (hasPor && hasEng) ? tessdataDir : undefined;
}

function findLanguagePath() {
  return ensureUnifiedTessdata();
}

async function recognizeImage(imagePath, progress) {
  var workerOptions = {
    logger: function (event) {
      if (event.status === 'recognizing text' && progress) {
        progress({ message: 'OCR: ' + Math.round((event.progress || 0) * 100) + '%', level: 'debug' });
      }
    },
  };

  const worker = await createWorker('por+eng', 1, workerOptions);
  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '11',
      user_defined_dpi: '300',
    });
    var result = await worker.recognize(imagePath);
    return result.data.text || '';
  } catch (err) {
    console.error('[OCR] Erro:', err.message);
    throw err;
  } finally {
    await worker.terminate();
  }
}

module.exports = { recognizeImage, findLanguagePath };