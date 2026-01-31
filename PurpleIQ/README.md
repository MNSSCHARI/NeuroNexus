# PurpleIQ

PurpleIQ is a full-stack application that provides AI-powered requirement analysis and test case generation. It features a React frontend with a tabbed interface and an Express backend integrated with OpenAI API.

## 🚀 Features

- **Requirement Analyzer**: Analyze requirements and get structured output including functional flow, preconditions, happy path, negative scenarios, and edge cases
- **Test Case Generator**: Generate comprehensive manual test cases with titles, steps, expected results, and priority levels
- **Workspace-Specific Prompts**: Different AI prompts optimized for different workspace types
- **Structured JSON Output**: All responses are returned in structured JSON format for easy integration

## 📁 Project Structure

```
PurpleIQ/
├── src/                    # React frontend source code
│   ├── App.jsx            # Main React component with tabbed interface
│   ├── App.css            # Styles for the application
│   ├── main.jsx           # React entry point
│   └── index.css          # Global styles
├── server/                 # Express backend server
│   ├── index.js           # Main server file with API endpoints
│   ├── prompts.js         # Prompt templates for different workspace types
│   ├── package.json       # Server dependencies
│   └── .env               # Environment variables (create this)
├── public/                 # Static assets
├── package.json           # Frontend dependencies
└── vite.config.js         # Vite configuration
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Frontend Setup

1. Navigate to the project root directory:
   ```bash
   cd PurpleIQ
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173` (or the port Vite assigns)

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install server dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `server` directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   ```

   The server will be available at `http://localhost:3000`

## 📖 Usage

### Frontend

1. Open the application in your browser (typically `http://localhost:5173`)
2. You'll see two tabs:
   - **Requirement Analyzer**: For analyzing requirements
   - **Test Case Generator**: For generating test cases
3. Enter your text in the textarea
4. Click the submit button to send the request to the backend

### API Endpoints

#### POST `/analyze`

Analyzes text based on workspace type using OpenAI.

**Request Body:**
```json
{
  "text": "User should be able to login with email and password",
  "workspaceType": "requirement"
}
```

**Workspace Types:**
- `requirement`: For requirement analysis (returns functional flow, preconditions, happy path, negative scenarios, edge cases)
- `testcase`: For test case generation (returns test case title, steps, expected result, priority)
- `development`: For development assistance (returns technical approach, technologies, architecture, etc.)

**Response:**
```json
{
  "success": true,
  "message": "Analysis completed successfully",
  "workspaceType": "requirement",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "analysis": {
    "functionalFlow": "...",
    "preconditions": [...],
    "happyPath": "...",
    "negativeScenarios": [...],
    "edgeCases": [...]
  },
  "metadata": {
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 200,
      "total_tokens": 300
    }
  }
}
```

#### GET `/health`

Health check endpoint to verify server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `server` directory with the following variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes | - |
| `OPENAI_MODEL` | OpenAI model to use | No | `gpt-4o-mini` |
| `PORT` | Server port | No | `3000` |

### Available OpenAI Models

- `gpt-4o-mini` (default, cost-effective)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

## 🎨 Code Structure

### Frontend (`src/App.jsx`)

- **State Management**: Uses React `useState` hooks to manage:
  - Active tab selection
  - Requirement input text
  - Test case input text
- **Event Handlers**: 
  - `handleRequirementSubmit`: Handles Requirement Analyzer form submission
  - `handleTestCaseSubmit`: Handles Test Case Generator form submission
- **Conditional Rendering**: Shows different forms based on active tab

### Backend (`server/index.js`)

- **Express Server**: Sets up HTTP server with CORS and JSON parsing middleware
- **OpenAI Integration**: 
  - Initializes OpenAI client with API key
  - Makes async API calls to OpenAI
  - Handles errors gracefully
- **Prompt System**: Uses workspace-specific prompts from `prompts.js`
- **Response Formatting**: Returns structured JSON with metadata

### Prompts (`server/prompts.js`)

- **Template System**: Provides different prompt templates for each workspace type
- **Formatting**: Replaces `{{input}}` placeholder with user text
- **Fallback**: Default template for unknown workspace types

## 🧪 Testing

### Test the API with cURL

```bash
# Test Requirement Analyzer
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "User should be able to login with email and password",
    "workspaceType": "requirement"
  }'

# Test Test Case Generator
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Login functionality with email and password",
    "workspaceType": "testcase"
  }'

# Test Health Endpoint
curl http://localhost:3000/health
```

## 🐛 Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is not configured"**
   - Make sure you've created a `.env` file in the `server` directory
   - Verify the API key is correct and has no extra spaces

2. **CORS Errors**
   - Ensure the backend server is running
   - Check that the frontend is making requests to the correct port (default: 3000)

3. **"Missing required fields"**
   - Ensure both `text` and `workspaceType` are included in the request body
   - Verify the request is sent as JSON with `Content-Type: application/json`

4. **OpenAI API Errors**
   - Check your API key is valid and has credits
   - Verify you have access to the specified model
   - Check rate limits if you're making many requests

## 📝 Development

### Running in Development Mode

**Frontend:**
```bash
npm run dev
```

**Backend:**
```bash
cd server
npm start
```

### Building for Production

**Frontend:**
```bash
npm run build
```

The built files will be in the `dist` directory.

## 🔐 Security Notes

- Never commit your `.env` file to version control
- Keep your OpenAI API key secure
- Consider implementing rate limiting for production use
- Add authentication/authorization for production deployments

## 📄 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue in the repository.

---

**Note**: This application requires an active OpenAI API key with sufficient credits to function.
