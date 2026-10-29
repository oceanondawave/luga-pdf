---
title: Luga PDF
emoji: 📑
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Luga PDF - Node.js Web App

A blazing-fast, 100% Python-free web application designed to convert **Baidu PaddleOCR-VL**, **MinerU**, or **ChatGPT/Claude** Markdown/JSON files into native, editable Microsoft Word (`.docx`) documents with **native OMML math equations**, real tables, embedded photos, and canonical Vietnamese diacritics.

---

## Key Highlights

- **100% Python-Free**: Built entirely with Node.js and Express. No Python runtime, no PyTorch, no local GBs of AI model weights.
- **Ultra-Fast (< 0.5s)**: Markdown & JSON compile almost instantaneously to Microsoft Word.
- **Native OMML Math**: Formulas are converted directly into Microsoft Word's native equation format (`m:oMath`), fully editable inside Word.
- **Tables & Embedded Photos**: Automatically downloads and embeds diagrams, charts, and photos from Baidu PaddleOCR JSON outputs.
- **Perfect Vietnamese OCR**: Preserves all Vietnamese diacritics with automatic Unicode NFC canonical normalization.
- **Accessible UI**: High-contrast, keyboard-navigable interface with screen-reader live regions (`aria-live="polite"`).

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (verified on Node v26)
- **Pandoc**:
  - **macOS**: `brew install pandoc`
  - **Windows**: `winget install pandoc` or `choco install pandoc`
  - **Linux / Ubuntu**: `sudo apt install pandoc`

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the web server
npm start
```

Open your browser and navigate to:
```
http://localhost:7860
```

---

## Docker Deployment

```bash
# Build Docker image
docker build -t luga-pdf .

# Run Docker container
docker run -p 7860:7860 luga-pdf
```
