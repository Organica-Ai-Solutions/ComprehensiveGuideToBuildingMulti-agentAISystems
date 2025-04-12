# Multi-Agent AI System Architecture

This repository contains a non-monolithic architecture for a multi-agent AI system, designed to be scalable, maintainable, and flexible for future development.

## Architecture Overview

The system follows a microservices architecture with the following components:

### Backend Services

1. **API Gateway** (`services/api_gateway`)
   - Entry point for all client requests
   - Handles authentication, rate limiting, and request routing
   - Proxies requests to appropriate services

2. **Agent Orchestration** (`services/agent_orchestration`)
   - Manages agent lifecycle and task coordination
   - Handles task assignment and tracking
   - Implements the core logic for multi-agent collaboration

3. **Tool Services** (`services/tools/*`)
   - Specialized services for different tool capabilities:
     - Search: Web and knowledge search capabilities
     - Calculation: Mathematical and computational tools
     - Data Retrieval: Database and API integration tools

4. **Memory Services** (`services/memory/*`)
   - Vector Store: Semantic search and embedding storage
   - Key-Value Store: Fast access to short-term memory
   - Document Store: Storage for conversation history and structured data

5. **LLM Proxy** (`services/llm_proxy`)
   - Abstracts communication with LLM providers (OpenAI, Anthropic, etc.)
   - Handles token budgeting, retries, and fallbacks
   - Manages prompt templates and generation parameters

### Frontend Components

1. **Core Application** (`frontend/core`)
   - Main application shell, routing, and state management
   - Authentication and user management
   - Global configuration

2. **Agent Interaction** (`frontend/agent_interaction`)
   - Chat interface and conversation components
   - Message rendering and history display
   - Input handling and command parsing

3. **Visualization** (`frontend/visualization`)
   - Components for visualizing agent thought processes
   - Tool usage monitoring
   - Task progress visualization

4. **Dashboard** (`frontend/dashboard`)
   - System monitoring and statistics
   - Agent performance metrics
   - Usage and resource tracking

### Shared Code

- Common interfaces, types, and utilities (`shared/`)
- Ensures consistent data structures across services

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Python 3.10+
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```bash
   # Install dependencies for each service
   cd code/services/api_gateway
   pip install -r requirements.txt
   # Repeat for other services
   ```

3. Install frontend dependencies:
   ```bash
   cd code/frontend
   npm install
   ```

### Environment Setup

Create `.env` files in each service directory with the appropriate configuration. Examples:

- `api_gateway/.env`:
  ```
  API_GATEWAY_KEY=your_api_key
  PORT=8000
  ```

- `llm_proxy/.env`:
  ```
  OPENAI_API_KEY=your_openai_key
  ANTHROPIC_API_KEY=your_anthropic_key
  ```

### Running the Services

1. Start the API Gateway:
   ```bash
   cd code/services/api_gateway
   uvicorn main:app --reload --port 8000
   ```

2. Start the Agent Orchestration service:
   ```bash
   cd code/services/agent_orchestration
   uvicorn main:app --reload --port 8001
   ```

3. Start other services similarly (adjust ports as defined in the API Gateway configuration)

4. Start the frontend:
   ```bash
   cd code/frontend
   npm run dev
   ```

## Development Guidelines

### Adding a New Service

1. Create a new directory in the appropriate category (e.g., `services/tools/new_tool`)
2. Implement the service using FastAPI
3. Define clear interfaces and document API endpoints
4. Add the service endpoint to the API Gateway configuration
5. Create appropriate frontend components if needed

### API Patterns

- All services should provide a `/health` endpoint
- Use consistent error handling and response formats
- Follow RESTful API design practices
- Document endpoints with OpenAPI/Swagger

### Communication Between Services

- Services should communicate via HTTP/REST
- Use the API Gateway for cross-service communication
- For high-performance requirements, consider direct service-to-service communication

## Deployment

The system is designed to be deployed as individual services, which can be containerized using Docker. See the `docker-compose.yml` file for an example deployment configuration.

## Project Structure Reference

```
code/
├── services/
│   ├── api_gateway/
│   ├── agent_orchestration/
│   ├── tools/
│   │   ├── search/
│   │   ├── calculation/
│   │   └── data_retrieval/
│   ├── memory/
│   │   ├── vector_store/
│   │   ├── key_value/
│   │   └── document_store/
│   └── llm_proxy/
├── frontend/
│   ├── core/
│   ├── agent_interaction/
│   ├── visualization/
│   └── dashboard/
└── shared/
```

## Contributing

Please follow the established code style and patterns when contributing to the project. Add appropriate tests for new functionality.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 