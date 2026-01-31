# PurpleIQ - Multi-Project AI Agent System

## Overview

PurpleIQ is now a multi-project, project-aware AI agent system where each project has its own memory (PRDs, documents, context) and the AI answers questions ONLY using documents stored for that specific project.

## Architecture

### Backend Structure

```
server/
├── models/
│   └── Project.js          # Project data model
├── services/
│   ├── VectorStore.js      # File-based vector database
│   ├── EmbeddingService.js # OpenAI embedding generation
│   ├── DocumentParser.js   # PDF/DOCX/TXT parsing
│   └── AIService.js         # LLM integration (OpenAI/Gemini)
├── storage/
│   └── ProjectStorage.js    # Project persistence
├── routes/
│   ├── projects.js          # Project management API
│   └── chat.js              # RAG chat API
└── data/
    ├── projects/            # Project metadata
    └── vectors/             # Vector embeddings (per project)
```

### Frontend Structure

```
src/
├── pages/
│   ├── AdminPortal.jsx      # Project management UI
│   └── ProjectChat.jsx      # Project-specific chat interface
├── SplashScreen.jsx         # Welcome screen
└── MainApp.jsx              # Legacy QA assistant
```

## Features

### 1. Project Management
- Create projects with unique IDs
- Configure AI model per project (OpenAI/Gemini/Claude)
- Store API keys securely (server-side only)
- Upload PRD and project documents

### 2. Document Processing
- Supports PDF, DOCX, and TXT files
- Automatic text extraction and chunking
- Embedding generation using OpenAI
- Vector storage with project isolation

### 3. Project Isolation
- Each project has its own vector store
- No cross-project data leakage
- Project-specific embeddings
- Secure API key management

### 4. RAG (Retrieval Augmented Generation)
- Question embedding generation
- Similarity search in project vector store
- Context retrieval from relevant chunks
- AI-powered answers grounded in project documents

### 5. Continuous Learning
- Add new documents to existing projects
- Incremental embedding updates
- All documents remain accessible
- AI reasons over complete project context

## API Endpoints

### Projects

- `GET /api/projects` - List all projects
- `GET /api/projects/:projectId` - Get project details
- `POST /api/projects` - Create new project
  ```json
  {
    "projectName": "My Project",
    "aiModel": "openai",
    "apiKey": "sk-..."
  }
  ```
- `POST /api/projects/:projectId/documents` - Upload document (multipart/form-data)
- `DELETE /api/projects/:projectId` - Delete project

### Chat

- `POST /api/chat/:projectId` - Ask question about project
  ```json
  {
    "question": "What are the main features?"
  }
  ```
  Response:
  ```json
  {
    "answer": "Based on the documents...",
    "sources": [
      {
        "documentName": "PRD.pdf",
        "chunkIndex": 5,
        "similarity": "0.9234"
      }
    ]
  }
  ```

## Setup Instructions

### Backend

1. Install dependencies:
   ```bash
   cd PurpleIQ/server
   npm install
   ```

2. Create `.env` file (optional, for legacy endpoints):
   ```env
   PORT=5000
   USE_MOCK_AI=false
   ```

3. Start server:
   ```bash
   npm start
   ```

### Frontend

1. Install dependencies:
   ```bash
   cd PurpleIQ
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

## Usage Flow

1. **Admin Portal** (`/admin`)
   - Create a new project
   - Enter project name, select AI model, provide API key
   - Upload PRD and project documents
   - Documents are automatically processed and embedded

2. **Project Chat** (`/project/:projectId`)
   - Open chat interface for specific project
   - Ask questions about the project
   - AI answers based ONLY on uploaded documents
   - See source documents for each answer

3. **Continuous Updates**
   - Upload new documents to existing projects
   - New documents are automatically embedded
   - AI can now answer using all project documents

## Security Features

- API keys stored server-side only
- Never exposed to frontend
- Each project uses its own API key
- Project isolation enforced at vector store level

## Data Storage

- **Projects**: `server/data/projects/projects.json`
- **Vectors**: `server/data/vectors/{projectId}.json`
- **Uploads**: `server/uploads/` (temporary, deleted after processing)

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + React Router
- **Vector Store**: File-based (can be swapped for Pinecone/FAISS)
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM**: OpenAI GPT-4o-mini / Google Gemini Pro

## Future Enhancements

- Claude integration
- Pinecone/FAISS vector database support
- API key encryption
- User authentication
- Document versioning
- Export functionality (PDF, Excel, DOCX, CSV)

