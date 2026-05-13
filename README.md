# Aura AI Desktop Assistant

Aura is a dual-mode desktop AI assistant powered by Electron, React, and Gemini/Ollama.

## Features
- **Dual Providers**: Seamlessly switch between Google Gemini (Cloud) and Ollama (Local).
- **Overlay Mode**: Floating, always-on-top mini-chat for quick queries.
- **Context Awareness**: Upload files or capture your screen for the AI to analyze.
- **Global Shortcut**: Press `Cmd/Ctrl + Shift + Space` anywhere to toggle the overlay.
- **Privacy First**: History and settings are stored locally on your machine.

## Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) (Optional, for local models)
- Gemini API Key (Optional, for cloud models)

## Local Setup
1. **Clone or Download** the project files.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   *Note: This will launch Vite and Electron simultaneously.*

## Build Instructions
To package the app for your current platform:
```bash
npm run build
```
The installer will be generated in the `dist/` and `dist-electron/` folders.

## Controls
- **Overlay Toggle**: `Cmd/Ctrl + Shift + Space`
- **Main Window**: Launch the app from your applications folder/start menu.
- **Screen Capture**: Use the camera icon in the composer to attach a screenshot of your primary display.
