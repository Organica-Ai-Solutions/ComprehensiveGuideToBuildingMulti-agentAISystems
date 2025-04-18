# Multi-Agent AI Systems Guide

A comprehensive guide and implementation for building multi-agent AI systems. This project includes both the theoretical documentation and a practical implementation of a multi-agent system.

## Project Structure

```
.
├── chapters/           # Documentation chapters
├── code/              # Implementation code
│   ├── backend/       # FastAPI backend
│   └── frontend/      # Frontend application
└── README.md          # This file
```

## Backend Implementation

The backend is built with FastAPI and provides a RESTful API for interacting with AI agents. It includes:

- Multiple agent types (Research Assistant, Code Helper, Writing Assistant)
- Real-time communication via WebSockets
- Chain of Thought reasoning
- System metrics and monitoring
- CORS support for multiple frontend origins

### Available Endpoints

- `GET /api/agents` - List all available agents
- `GET /api/agents/{agent_id}` - Get specific agent details
- `POST /api/agents/{agent_id}/chat` - Chat with a specific agent
- `GET /api/metrics` - Get system metrics
- `WebSocket /ws/{agent_id}` - Real-time communication with agents

### Running the Backend

1. Navigate to the backend directory:
   ```bash
   cd code/backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the server:
   ```bash
   python main.py
   ```

The server will start on `http://localhost:8000`. You can access the API documentation at `http://localhost:8000/docs`.

### Testing the API

You can test the endpoints using curl:

```bash
# List all agents
curl http://localhost:8000/api/agents

# Get specific agent
curl http://localhost:8000/api/agents/1

# Chat with an agent
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, can you help me with research?"}'

# Get system metrics
curl http://localhost:8000/api/metrics
```

## Frontend Implementation

The frontend provides a user interface for interacting with the agents. It includes:

- Agent selection interface
- Real-time chat functionality
- Visualization of agent reasoning steps
- System metrics dashboard

### Running the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd code/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`.

## Documentation

The `chapters/` directory contains detailed documentation about:

- Chain of Thought (CoT) Reasoning
- The ReAct Paradigm
- Cloud API & Deployment Strategies
- Multi-Agent Communication Protocols
- Implementation Best Practices

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.