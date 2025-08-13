# DocuChat - Document-Based AI Chatbot

A comprehensive document-based chatbot application that allows users to ask questions about preloaded documents using AI. The system includes web and mobile interfaces with advanced features like conversation history, web search fallback, and stock data integration.

# Brief Summary of Design & Implementation

- Tech Stack: Node.js with TypeScript and Express.js for backend; React with TypeScript for web frontend; React Native with Expo for mobile.
- AI Integration: Uses Ollama (local LLM) for generating context-aware, document-grounded responses.
- Document Processing: Implements custom text splitting and chunking logic to prepare documents for indexing and retrieval.
- Vector Search: Uses a TF-IDF based similarity search to identify the most relevant document chunks for a given query.
- External APIs: Integrates Alpha Vantage for stock data and SerpAPI for real-time web search augmentation.
- Architecture: Modular

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Ollama
- Expo CLI for mobile development - `npm install -g @expo/cli`

### Setting up Ollama

1. Install Ollama from [ollama.com](https://ollama.com/)

   ### macOS

   brew install ollama

   ### Linux

   curl -fsSL https://ollama.ai/install.sh | sh

2. Pull the model:

   ollama pull llama3.2

3. Start Ollama service:

   ollama serve

## Installation & Setup

### 1. Clone the Repository

git clone https://github.com/Shreyanshi-Vashistha/DocuChat.git

### 2. Backend Setup

cd backend

1. Install dependencies:

   npm install

2. Environment Setup:
   Create a .env file in the backend directory:

   PORT=5001

   OLLAMA_URL=http://localhost:11434

   ### For real stock data

   ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

   ### For web search

   SERPAPI_KEY=your_serpapi_key

3. Build the project:

   npm run build

4. Start the server:

   Development mode

   npm run dev

   Production mode

   npm start

The server will start on http://localhost:5001

### 3. Frontend Setup

cd frontend

1. Install dependencies:

   npm install

2. Environment Setup:
   Create a .env file in the frontend directory:

   VITE_API_URL=http://localhost:5001/api

3. Start the server:
   npm run dev

The server will start on http://localhost:3000

### 4. Mobile Setup

cd mobile

1. Install dependencies:

   npm install

   #### If you encounter dependency conflicts, use:
   
   npm install --legacy-peer-deps

2. Update Expo CLI (if needed)

   npm uninstall -g expo-cli

   npm install -g @expo/cli@latest
   
3. Environment Setup:
   
   Create a .env file in the mobile directory:

   #### Replace with your computer's actual IP address
   
   EXPO_PUBLIC_API_BASE_URL=http://<<<your-ip-address>>>:5001/api

4. Start the server:

   #### Start with cache clearing

   npx expo start --clear

   #### Or regular start
   
   npx expo start

5. Connect Your Device:

   #### Use Expo Go
   
   1. Install Expo Go from App Store (iOS) or Play Store (Android)
   
   2. Scan the QR code displayed in your terminal
   
   3. The app will load on your device
  
   #### Use ios Emulator

   npx expo run:ios
      
   #### Use Android Emulator
   
   npx expo run:android

