import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lockPath = path.resolve(__dirname, '../apps/web/public/pyodide/pyodide-lock.json');
const destDir = path.resolve(__dirname, '../apps/web/public/pyodide');

if (!fs.existsSync(lockPath)) {
  console.error('pyodide-lock.json not found at', lockPath);
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

function getDeps(targets) {
  const visited = new Set();
  const queue = [...targets];
  while (queue.length > 0) {
    const pkg = queue.shift();
    if (!pkg || visited.has(pkg)) continue;
    visited.add(pkg);
    const entry = lock.packages[pkg];
    if (entry && entry.depends) {
      for (const dep of entry.depends) {
        if (!visited.has(dep)) queue.push(dep);
      }
    }
  }
  return visited;
}

const targetPackages = ['seaborn', 'pandas', 'numpy', 'matplotlib', 'scikit-learn', 'pillow', 'requests', 'regex', 'pyodide-http'];
const needed = Array.from(getDeps(targetPackages));
const filesToDownload = needed.map(pkg => lock.packages[pkg]?.file_name).filter(Boolean);

console.log(`Found ${filesToDownload.length} wheels to download for: ${targetPackages.join(', ')}`);

function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(destDir, fileName);
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 0) {
        console.log(`[EXISTS] ${fileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        return resolve();
      }
    }

    let url = `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/${fileName}`;
    if (fileName.startsWith('seaborn-')) {
      url = `https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/${fileName}`;
    }
    console.log(`[DOWNLOADING] ${fileName}...`);
    const fileStream = fs.createWriteStream(destPath);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download ${fileName}: HTTP ${res.statusCode}`));
      }

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          const stat = fs.statSync(destPath);
          console.log(`[DONE] ${fileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fileStream.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function main() {
  for (const file of filesToDownload) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All wheels successfully downloaded to apps/web/public/pyodide!');
}

main();
