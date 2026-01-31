# PurpleIQ Multi-Project Setup Guide

## Quick Start

### 1. Install Backend Dependencies

```bash
cd PurpleIQ/server
npm install
```

This will install:
- Express, CORS, dotenv
- Multer (file uploads)
- pdf-parse, mammoth (document parsing)
- OpenAI SDK (embeddings)
- Google Generative AI (Gemini)
- uuid, fs-extra

### 2. Install Frontend Dependencies

```bash
cd PurpleIQ
npm install
```

This will install:
- React Router DOM (routing)

### 3. Start Backend Server

```bash
cd PurpleIQ/server
npm start
```

Server runs on `http://localhost:5000`

### 4. Start Frontend

```bash
cd PurpleIQ
npm run dev
```

Frontend runs on `http://localhost:5173` (or Vite's assigned port)

## First Time Setup

### Create Your First Project

1. Navigate to Admin Portal: `http://localhost:5173/admin`
2. Click "Create Project"
3. Fill in:
   - **Project Name**: e.g., "E-Commerce Platform"
   - **AI Model**: Select OpenAI or Gemini
   - **API Key**: Enter your API key for the selected model
4. Click "Create Project"

### Upload Documents

1. In the project card, click "Upload Document"
2. Select a PDF, DOCX, or TXT file
3. Wait for processing (document is parsed, chunked, and embedded)
4. You'll see the document count update

### Start Chatting

1. Click "Open Chat" on a project card
2. Or navigate to `/project/{projectId}`
3. Ask questions about your project
4. AI will answer based ONLY on uploaded documents

## API Key Requirements

### For OpenAI Projects
- Get API key from: https://platform.openai.com/api-keys
- Used for: Embeddings (text-embedding-3-small) and Chat (gpt-4o-mini)

### For Gemini Projects
- Get API key from: https://makersuite.google.com/app/apikey
- Used for: Chat (gemini-pro)

## File Structure After Setup

```
PurpleIQ/
├── server/
│   ├── data/
│   │   ├── projects/
│   │   │   └── projects.json      # Project metadata
│   │   └── vectors/
│   │       └── {projectId}.json   # Vector embeddings per project
│   └── uploads/                    # Temporary file storage
└── src/
    └── pages/
        ├── AdminPortal.jsx        # Project management
        └── ProjectChat.jsx         # Chat interface
```

## Testing the System

### 1. Create a Test Project

```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Test Project",
    "aiModel": "openai",
    "apiKey": "your-api-key-here"
  }'
```

### 2. Upload a Test Document

```bash
curl -X POST http://localhost:5000/api/projects/{projectId}/documents \
  -F "document=@/path/to/your/document.pdf"
```

### 3. Ask a Question

```bash
curl -X POST http://localhost:5000/api/chat/{projectId} \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main features?"
  }'
```

## Troubleshooting

### "Project not found" Error
- Ensure projectId is correct
- Check that project exists in `server/data/projects/projects.json`

### "No documents found" Error
- Upload at least one document to the project
- Wait for document processing to complete

### Embedding Generation Fails
- Verify API key is valid
- Check API key has sufficient credits
- For OpenAI: Ensure access to embedding models

### Document Upload Fails
- Check file size (max 10MB)
- Verify file type (PDF, DOCX, TXT only)
- Check server logs for parsing errors

## Production Considerations

1. **API Key Encryption**: Currently stored in plain text. Encrypt before production.
2. **Vector Database**: Consider migrating to Pinecone or FAISS for scale.
3. **Authentication**: Add user authentication and authorization.
4. **Rate Limiting**: Implement rate limiting for API endpoints.
5. **Error Handling**: Enhance error messages and logging.
6. **Data Backup**: Implement backup strategy for project data.

## Next Steps

- Add Claude integration
- Implement document export (PDF, Excel, DOCX, CSV)
- Add document versioning
- Create project templates
- Add team collaboration features

