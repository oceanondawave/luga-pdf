/**
 * Luga PDF - Pure Node.js Web Server
 * High-Fidelity Markdown / JSON to Microsoft Word (.docx) compiler
 * - Native OMML math equations (<m:oMath>)
 * - Real Microsoft Word tables (<w:tbl>)
 * - Embedded diagrams, graphs, and photos (<w:drawing>)
 * - Canonical Vietnamese diacritics (Unicode NFC)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 7860;

// Directories
const UPLOADS_DIR = path.join(__dirname, 'storage', 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'storage', 'outputs');
const STATIC_DIR = path.join(__dirname, 'app', 'static');

[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Locate Pandoc binary across macOS, Windows, and Linux
function findPandoc() {
  if (process.env.PANDOC_PATH && fs.existsSync(process.env.PANDOC_PATH)) {
    return process.env.PANDOC_PATH;
  }

  const candidates = [
    'pandoc',
    '/opt/homebrew/bin/pandoc',
    '/usr/local/bin/pandoc',
    '/usr/bin/pandoc',
    'C:\\Program Files\\Pandoc\\pandoc.exe',
    'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Pandoc', 'pandoc.exe'),
  ];

  for (const bin of candidates) {
    try {
      execSync(`"${bin}" --version`, { stdio: 'ignore' });
      return bin;
    } catch {
      // continue search
    }
  }

  return null;
}

const pandocBinary = findPandoc();
console.log(`[Luga PDF] Pandoc binary: ${pandocBinary || 'NOT FOUND'}`);

// In-Memory Task Storage with automatic 1-hour cleanup
const tasks = new Map();

setInterval(() => {
  const oneHourAgo = Date.now() - 3600 * 1000;
  for (const [taskId, task] of tasks.entries()) {
    if (task.createdAt < oneHourAgo) {
      if (task.docxPath && fs.existsSync(task.docxPath)) {
        try { fs.unlinkSync(task.docxPath); } catch {}
      }
      tasks.delete(taskId);
    }
  }
}, 10 * 60 * 1000);

// Multer storage
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(STATIC_DIR));

// Clean math formulas and LaTeX OCR typos
function fixMathFormulas(text) {
  if (typeof text !== 'string') return '';

  // Fix display math $$ ... $$
  text = text.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (m, inner) => `\n\n$$\n${inner.trim()}\n$$\n\n`);

  // Fix inline math $ ... $ where leading or trailing spaces prevent Pandoc from parsing
  text = text.replace(/\$([ \t]+)([^$\n]+?)\$/g, (m, sp, inner) => `$${inner.trim()}$`);
  text = text.replace(/\$([^$\n]+?)([ \t]+)\$/g, (m, inner, sp) => `$${inner.trim()}$`);

  // Fix OCR command typos
  text = text
    .replace(/\\Tilde\{/g, '\\tilde{')
    .replace(/\\Ddot\{/g, '\\ddot{')
    .replace(/\\Bar\{/g, '\\bar{')
    .replace(/\\Hat\{/g, '\\hat{')
    .replace(/\\Vec\{/g, '\\vec{')
    .replace(/\\textcircled\{([^}]+)\}/g, '($1)');

  return text;
}

// Convert HTML tables (<table...>) into native Markdown tables using Pandoc
function convertHtmlTablesToMarkdown(text) {
  if (typeof text !== 'string' || !pandocBinary) return text;

  return text.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    try {
      const mdTable = execSync(`"${pandocBinary}" -f html -t markdown`, { input: tableHtml }).toString();
      return `\n\n${mdTable.trim()}\n\n`;
    } catch {
      return tableHtml;
    }
  });
}

// Download remote image URLs to local task working directory
async function downloadImages(imageMap, imgsDir) {
  if (!imageMap || Object.keys(imageMap).length === 0) return;
  fs.mkdirSync(imgsDir, { recursive: true });

  await Promise.allSettled(
    Object.entries(imageMap).map(async ([relPath, url]) => {
      try {
        const filename = path.basename(relPath);
        const dest = path.join(imgsDir, filename);
        if (fs.existsSync(dest)) return;

        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return;

        const buf = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buf));
      } catch {
        // Continue even if an individual image fails to download
      }
    })
  );
}

// Process markdown typography, formulas, tables, and images
function prepareMarkdown(text) {
  let md = text;

  // 1. Convert HTML tables to Markdown grid/pipe tables
  md = convertHtmlTablesToMarkdown(md);

  // 2. Fix dollar math boundary spaces and OCR typos
  md = fixMathFormulas(md);

  // 3. Normalize <img src="imgs/..." ... /> to standard Markdown image syntax
  md = md.replace(/<img[^>]*src=["']imgs\/([^"'\s]+)["'][^>]*>/gi, '\n\n![](imgs/$1)\n\n');

  // 4. Unicode NFC normalization for canonical Vietnamese diacritics
  return md.normalize('NFC');
}

// Compile Markdown to DOCX with native OMML equations
function compileToDocx(markdownText, outputPath, workDir) {
  return new Promise((resolve, reject) => {
    if (!pandocBinary) {
      return reject(new Error('Pandoc binary not found. Please install Pandoc (e.g. brew install pandoc).'));
    }

    const tempMdPath = path.join(workDir, `document_${crypto.randomUUID()}.md`);
    fs.writeFileSync(tempMdPath, markdownText, 'utf8');

    const args = [
      '-f', 'markdown+tex_math_dollars+tex_math_single_backslash+pipe_tables+grid_tables',
      '-t', 'docx',
      '-o', outputPath,
      tempMdPath,
    ];

    const child = spawn(pandocBinary, args, { cwd: workDir });
    let stderr = '';

    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      try { fs.unlinkSync(tempMdPath); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`Pandoc error (${code}): ${stderr || 'Compilation failed'}`));
    });
    child.on('error', (err) => {
      try { fs.unlinkSync(tempMdPath); } catch {}
      reject(err);
    });
  });
}

// POST /api/convert-text (Direct Paste & Convert)
app.post('/api/convert-text', async (req, res) => {
  const { text, filename } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ detail: 'No text provided.' });
  }

  const taskId = crypto.randomUUID();
  const taskDir = path.join(UPLOADS_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });

  const outputFilename = (filename && filename.trim() ? filename.trim().replace(/\.[^/.]+$/, '') : 'document') + '.docx';
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}_${outputFilename}`);

  try {
    const cleanedMd = prepareMarkdown(text);
    await compileToDocx(cleanedMd, outputPath, taskDir);

    const stats = fs.statSync(outputPath);
    const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    tasks.set(taskId, {
      id: taskId,
      status: 'completed',
      progress: 100,
      message: 'Word document compiled successfully!',
      filename: outputFilename,
      docxPath: outputPath,
      file_size_mb: fileSizeMb,
      download_url: `/api/download/${taskId}`,
      createdAt: Date.now(),
    });

    try { fs.rmSync(taskDir, { recursive: true, force: true }); } catch {}

    return res.json({
      task_id: taskId,
      filename: outputFilename,
      file_size_mb: fileSizeMb,
      download_url: `/api/download/${taskId}`,
    });
  } catch (err) {
    try { fs.rmSync(taskDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/convert (File Upload: .md, .markdown, .json)
app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: 'No file uploaded.' });
  }

  const taskId = crypto.randomUUID();
  const taskDir = path.join(UPLOADS_DIR, taskId);
  const imgsDir = path.join(taskDir, 'imgs');
  fs.mkdirSync(taskDir, { recursive: true });

  const originalExt = path.extname(req.file.originalname).toLowerCase();
  const baseName = path.basename(req.file.originalname, originalExt);
  const outputFilename = `${baseName}.docx`;
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}_${outputFilename}`);

  try {
    const rawContent = fs.readFileSync(req.file.path, 'utf8');
    let extractedText = '';
    const imageMap = {};

    if (originalExt === '.json') {
      const data = JSON.parse(rawContent);

      if (Array.isArray(data)) {
        // Multi-page PaddleOCR-VL format
        extractedText = data.map((item) => {
          if (typeof item === 'string') return item;
          if (item && item.markdown) {
            if (item.markdown.images) Object.assign(imageMap, item.markdown.images);
            if (typeof item.markdown === 'string') return item.markdown;
            if (typeof item.markdown.text === 'string') return item.markdown.text;
          }
          if (item && typeof item.text === 'string') return item.text;
          if (item && typeof item.content === 'string') return item.content;
          return '';
        }).filter(Boolean).join('\n\n');
      } else {
        if (data.images) Object.assign(imageMap, data.images);
        if (data.markdown && data.markdown.images) Object.assign(imageMap, data.markdown.images);

        if (typeof data.markdown === 'string') extractedText = data.markdown;
        else if (data.markdown && typeof data.markdown.text === 'string') extractedText = data.markdown.text;
        else if (data.result && typeof data.result.markdown === 'string') extractedText = data.result.markdown;
        else if (typeof data.text === 'string') extractedText = data.text;
        else extractedText = JSON.stringify(data, null, 2);
      }
    } else {
      extractedText = rawContent;
    }

    // Download any referenced charts, graphs, and photos in parallel
    await downloadImages(imageMap, imgsDir);

    // Clean formulas, convert tables, normalize typography
    const cleanedMd = prepareMarkdown(extractedText);

    // Compile to Word with native OMML equations and embedded images
    await compileToDocx(cleanedMd, outputPath, taskDir);

    // Clean up temporary uploads
    try { fs.unlinkSync(req.file.path); } catch {}
    try { fs.rmSync(taskDir, { recursive: true, force: true }); } catch {}

    const stats = fs.statSync(outputPath);
    const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    tasks.set(taskId, {
      id: taskId,
      status: 'completed',
      progress: 100,
      message: 'Word document compiled successfully!',
      filename: outputFilename,
      docxPath: outputPath,
      file_size_mb: fileSizeMb,
      download_url: `/api/download/${taskId}`,
      createdAt: Date.now(),
    });

    return res.json({
      task_id: taskId,
      filename: outputFilename,
      file_size_mb: fileSizeMb,
      download_url: `/api/download/${taskId}`,
    });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    try { fs.rmSync(taskDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({ detail: err.message });
  }
});

// GET /api/status/:taskId
app.get('/api/status/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ detail: 'Task not found or expired.' });
  }
  return res.json(task);
});

// GET /api/download/:taskId
app.get('/api/download/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task || task.status !== 'completed' || !task.docxPath || !fs.existsSync(task.docxPath)) {
    return res.status(404).json({ detail: 'File not found or compilation incomplete.' });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(task.filename)}"`);
  res.sendFile(path.resolve(task.docxPath));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    pandoc_available: !!pandocBinary,
    node_version: process.version,
    active_tasks: tasks.size,
  });
});

app.listen(PORT, () => {
  console.log(`[Luga PDF] Web Server running at http://localhost:${PORT}`);
  console.log(`[Luga PDF] Formulas, Tables & Photos Compiler Active`);
});
