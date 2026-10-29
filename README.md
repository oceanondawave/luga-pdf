# Luga PDF - Node.js Web App

A blazing-fast, 100% Python-free web application designed to convert **Baidu PaddleOCR-VL**, **MinerU**, or **ChatGPT/Claude** Markdown/JSON files into native, editable Microsoft Word (`.docx`) documents with **native OMML math equations**, real tables, and canonical Vietnamese diacritics.

---

## Key Highlights

- **100% Python-Free**: Built entirely with Node.js and Express. No Python runtime, no PyTorch, no local GBs of AI model weights.
- **Ultra-Fast (< 0.5s)**: Markdown & JSON compile almost instantaneously to Microsoft Word.
- **Native OMML Math**: Formulas are converted directly into Microsoft Word's native equation format (`m:oMath`), fully editable inside Word.
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

## Recommended Workflow

1. Go to **[Baidu AI Studio PaddleOCR](https://aistudio.baidu.com/paddleocr)**.
2. Upload your PDF with complex formulas, graphs, and tables. Baidu runs its server-grade vision-language models for free.
3. Export / download the **Markdown (.md)** or **JSON** file.
4. Drag and drop the `.md` or `.json` file into **Luga PDF** at `http://localhost:7860`.
5. Click **Compile to Word (.docx)**. Within half a second, download your editable Word document with real equations and tables!

---

## Docker Deployment

```bash
# Build Docker image
docker build -t luga-pdf .

# Run Docker container
docker run -p 7860:7860 luga-pdf
```
