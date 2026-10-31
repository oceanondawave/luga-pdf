/**
 * Luga PDF - Minimal, High-Fidelity Client
 * Handles file selection, locking all inputs during conversion,
 * status feedback, and download.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // DOM Elements
  const form = document.getElementById("conversion-form");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const dropzoneEmpty = document.getElementById("dropzone-empty");
  const dropzoneSelected = document.getElementById("dropzone-selected");
  const selectedFilename = document.getElementById("selected-filename");
  const selectedFilesize = document.getElementById("selected-filesize");
  const btnRemoveFile = document.getElementById("btn-remove-file");
  const btnConvert = document.getElementById("btn-convert");

  // Output States
  const processingState = document.getElementById("processing-state");
  const completedState = document.getElementById("completed-state");
  const completedFilename = document.getElementById("completed-filename");
  const completedFilesize = document.getElementById("completed-filesize");
  const btnDownload = document.getElementById("btn-download");
  const btnConvertAnother = document.getElementById("btn-convert-another");

  // Error States
  const errorState = document.getElementById("error-state");
  const errorMessageText = document.getElementById("error-message-text");
  const btnTryAgain = document.getElementById("btn-try-again");

  // Announcers
  const srStatusAnnouncer = document.getElementById("sr-status-announcer");
  const srAlertAnnouncer = document.getElementById("sr-alert-announcer");

  let selectedFile = null;
  let isConverting = false;

  function announceStatus(msg) {
    if (srStatusAnnouncer) {
      srStatusAnnouncer.textContent = "";
      setTimeout(() => { srStatusAnnouncer.textContent = msg; }, 50);
    }
  }

  function announceAlert(msg) {
    if (srAlertAnnouncer) {
      srAlertAnnouncer.textContent = "";
      setTimeout(() => { srAlertAnnouncer.textContent = msg; }, 50);
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // File Handling
  function handleFile(file) {
    if (!file || isConverting) return;

    const lower = file.name.toLowerCase();
    const valid = lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt");
    if (!valid) {
      announceAlert("Please select a .json or .md file from PaddleOCR.");
      alert("Please select a valid .json or .md file from PaddleOCR.");
      return;
    }

    selectedFile = file;
    selectedFilename.textContent = file.name;
    selectedFilesize.textContent = formatBytes(file.size);

    dropzoneEmpty.classList.add("hidden");
    dropzoneSelected.classList.remove("hidden");
    dropzoneSelected.classList.add("flex");

    btnConvert.disabled = false;
    btnConvert.removeAttribute("aria-disabled");

    announceStatus(`File selected: ${file.name}`);
  }

  function removeFile(e) {
    if (e) e.stopPropagation();
    if (isConverting) return; // Locked during conversion

    selectedFile = null;
    fileInput.value = "";

    dropzoneSelected.classList.add("hidden");
    dropzoneSelected.classList.remove("flex");
    dropzoneEmpty.classList.remove("hidden");

    btnConvert.disabled = true;
    btnConvert.setAttribute("aria-disabled", "true");

    announceStatus("File removed.");
    dropzone.focus();
  }

  dropzone.addEventListener("click", () => {
    if (!selectedFile && !isConverting) fileInput.click();
  });

  dropzone.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !selectedFile && !isConverting) {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0] && !isConverting) {
      handleFile(e.target.files[0]);
    }
  });

  btnRemoveFile.addEventListener("click", removeFile);

  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (isConverting) return;
      dropzone.classList.add("border-blue-600", "bg-blue-50/50");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("border-blue-600", "bg-blue-50/50");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    if (isConverting) return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Lock and disable all inputs completely
  function lockAllInputs() {
    isConverting = true;

    // Disable file input
    fileInput.disabled = true;

    // Lock and disable dropzone
    dropzone.setAttribute("tabindex", "-1");
    dropzone.setAttribute("aria-disabled", "true");
    dropzone.classList.add("pointer-events-none", "opacity-50", "cursor-not-allowed");

    // Lock and disable remove button
    btnRemoveFile.disabled = true;
    btnRemoveFile.setAttribute("aria-disabled", "true");
    btnRemoveFile.classList.add("pointer-events-none", "opacity-40", "cursor-not-allowed");

    // Lock convert button
    btnConvert.disabled = true;
    btnConvert.setAttribute("aria-disabled", "true");
    btnConvert.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Converting Document...`;

    // Show processing section
    form.classList.add("hidden");
    processingState.classList.remove("hidden");
    processingState.setAttribute("aria-busy", "true");

    const progressStatusEl = document.getElementById("progress-status-text");
    if (progressStatusEl) {
      if (selectedFile && selectedFile.size > 2 * 1024 * 1024) {
        progressStatusEl.textContent = "Processing large document (downloading photos, compiling tables & math formulas)...";
      } else {
        progressStatusEl.textContent = "Compiling tables, math formulas & photos...";
      }
    }

    if (window.lucide) window.lucide.createIcons();
    announceStatus("Converting document. All inputs locked.");
  }

  // Unlock all inputs
  function unlockAllInputs() {
    isConverting = false;

    fileInput.disabled = false;

    dropzone.setAttribute("tabindex", "0");
    dropzone.removeAttribute("aria-disabled");
    dropzone.classList.remove("pointer-events-none", "opacity-50", "cursor-not-allowed");

    btnRemoveFile.disabled = false;
    btnRemoveFile.removeAttribute("aria-disabled");
    btnRemoveFile.classList.remove("pointer-events-none", "opacity-40", "cursor-not-allowed");

    btnConvert.disabled = selectedFile ? false : true;
    if (selectedFile) btnConvert.removeAttribute("aria-disabled");
    btnConvert.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5"></i> Convert to Word (.docx)`;

    processingState.classList.add("hidden");
    processingState.setAttribute("aria-busy", "false");

    if (window.lucide) window.lucide.createIcons();
  }

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile || isConverting) return;

    lockAllInputs();

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `Server returned status ${res.status}`;
        try {
          const err = await res.json();
          if (err && err.detail) errorMsg = err.detail;
        } catch {
          try {
            const txt = await res.text();
            if (txt) errorMsg = txt.slice(0, 150);
          } catch {}
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      showSuccess(data);
    } catch (err) {
      showError(err.message || "Failed to convert document.");
    } finally {
      unlockAllInputs();
    }
  });

  // State Transitions
  function showSuccess(data) {
    form.classList.add("hidden");
    processingState.classList.add("hidden");
    errorState.classList.add("hidden");

    completedState.classList.remove("hidden");
    completedFilename.textContent = data.filename || "document.docx";
    completedFilesize.textContent = data.file_size_mb ? `${data.file_size_mb} MB` : "Ready";
    btnDownload.href = data.download_url || "#";
    btnDownload.setAttribute("download", data.filename || "document.docx");

    announceAlert("Word document ready! You can now download it.");
    btnDownload.focus();
  }

  function showError(msg) {
    form.classList.add("hidden");
    processingState.classList.add("hidden");
    completedState.classList.add("hidden");

    errorState.classList.remove("hidden");
    errorMessageText.textContent = msg || "An unexpected error occurred.";
    announceAlert(`Conversion failed: ${msg}`);
    btnTryAgain.focus();
  }

  function resetToUpload() {
    completedState.classList.add("hidden");
    errorState.classList.add("hidden");
    form.classList.remove("hidden");
    removeFile();
  }

  btnConvertAnother.addEventListener("click", resetToUpload);
  btnTryAgain.addEventListener("click", resetToUpload);
});
