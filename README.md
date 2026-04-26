---
title: ExeLearning AI Compiler
emoji: 🔥
colorFrom: blue
colorTo: purple
sdk: static
pinned: false
license: mit
---

# ExeLearning AI Compiler

A WebGPU-powered application that generates `content.xml` and `.elpx` files for eXeLearning v4.0.0 using local Gemma 4 ONNX models.

## Features
- **Local AI:** Uses `@huggingface/transformers` to run Gemma 4 E2B or E4B entirely in the browser. No API keys needed.
- **Pedagogical Design:** Given a LOMLOE Learning Situation (SA), the AI designs the pedagogical flow and selects the most appropriate iDevices.
- **Client-Side Compilation:** A robust `JSZip` engine matches the AI's output with authentic eXeLearning v4.0 XML snippets, encoding complex components into Vue-compatible URI hashes.
- **Privacy:** 100% of data processing occurs on your device.

## Architecture
- `worker.js`: Handles WebGPU inference via WebWorkers to prevent blocking the UI.
- `compiler.js`: Serializes the JSON outputs, applies URI encoding where necessary, generates UUIDs, and wraps it into a ZIP file.
- `docs/exelearning_idevice_snippets.md`: The raw knowledge base holding the 18 exact snippet types used by eXeLearning.
