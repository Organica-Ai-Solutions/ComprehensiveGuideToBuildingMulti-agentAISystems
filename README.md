# Multi-Agent AI Systems Guide

A comprehensive guide and implementation for building multi-agent AI systems. This project includes both the theoretical documentation and a practical implementation of a multi-agent system.

## Project Structure

```
.
├── chapters/           # Documentation chapters
├── code/              # Implementation code
│   ├── backend/       # FastAPI backend
│   └── frontend/      # Frontend application
│   └── tests/         # Test suites
└── README.md          # This file
```

## System Architecture

```mermaid
graph TB
    subgraph Frontend
        UI[User Interface]
        WS[WebSocket Client]
        Metrics[Metrics Dashboard]
    end

    subgraph Backend
        API[FastAPI Server]
        AgentMgr[Agent Manager]
        Tools[Tool Registry]
        subgraph Agents
            RA[Research Agent]
            CA[Coder Agent]
            GA[General Agent]
        end
    end

    subgraph MCP[Master Control Program]
        MServer[MCP Server]
        MClient[MCP Client]
        TaskQ[Task Queue]
    end

    UI --> WS
    UI --> API
    WS --> MServer
    API --> AgentMgr
    AgentMgr --> Agents
    Agents --> Tools
    MServer --> TaskQ
    TaskQ --> MClient
    MClient --> Agents
    Agents --> Metrics
```

## Startup Process

```mermaid
sequenceDiagram
    participant User
    participant Script as start_system.sh
    participant MCP as MCP Server
    participant Client as MCP Client
    participant Backend
    participant Frontend

    User->>Script: Execute start_system.sh
    Script->>MCP: Start MCP Server
    Note over MCP: Initialize Task Queue
    Script->>Client: Start MCP Client
    Note over Client: Connect to MCP Server
    Script->>Backend: Start Backend Server
    Note over Backend: Initialize Agents & Tools
    Script->>Frontend: Start Frontend Server
    Note over Frontend: Setup UI & WebSocket
    Script->>User: Display Access URLs
    Note over Script: Create stop_system.sh
    Note over Script: Begin log monitoring
```

## Component Communication

```mermaid
flowchart LR
    subgraph User Interface
        Chat[Chat Interface]
        Status[Status Display]
    end

    subgraph Agent System
        AgentEntryPoint{Agent Entry}
        RA[Research Agent]
        CA[Coder Agent]
        Tools[Tool Registry]
        AgentEntryPoint --> RA
        AgentEntryPoint --> CA
        RA --> Tools
        CA --> Tools
    end

    subgraph Processing
        Val[Input Validation]
        Safety[Safety Checks]
        History[Chat History]
    end

    Chat -->|User Input| Val
    Val -->|Validated| Safety
    Safety -->|Safe Input| AgentEntryPoint
    RA -->|Response| History
    CA -->|Response| History
    History -->|Update| Status
    Status -->|Display| Chat
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

The server will start on `http://localhost:5000`. You can access the API documentation at `http://localhost:5000/docs`.

### Testing the API

You can test the endpoints using curl:

```bash
# List all agents
curl http://localhost:5000/api/agents

# Get specific agent
curl http://localhost:5000/api/agents/1

# Chat with an agent
curl -X POST http://localhost:5000/api/agents/1/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, can you help me with research?"}'

# Get system metrics
curl http://localhost:5000/api/metrics
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

## Testing Infrastructure

The project includes comprehensive test suites for all major components:

### Core Test Suites

1. **Agent Processors Tests**
   - Research processor validation
   - Code processor safety checks
   - API integration testing
   - Error handling verification

2. **Safety Guardrails Tests**
   - Code safety validation
   - Tool usage permissions
   - Resource limit monitoring
   - Content safety checks
   - Metrics integration

3. **Agent Orchestration Tests**
   - Message processing validation
   - Tool request handling
   - Agent handoff management
   - Resource usage monitoring
   - Timeout handling

### Running Tests

1. Install test dependencies:
   ```bash
   pip install pytest pytest-asyncio
   npm install jest @jest/globals
   ```

2. Run backend tests:
   ```bash
   cd code/backend
   pytest tests/
   ```

3. Run frontend tests:
   ```bash
   cd code/frontend
   npm test
   ```

### Test Coverage Areas

- **Functionality Testing**
  - UI interactions
  - Form submissions
  - Data display
  - Error handling
  - Token counting
  - Metrics tracking
  - Real-time updates

- **Regression Testing**
  - UI consistency
  - API compatibility
  - Backward compatibility

- **Safety Testing**
  - Code execution safety
  - Resource limits
  - Content filtering
  - Tool usage permissions

## Development Guidelines

### Testing Guidelines

1. **Writing Tests**
   - Write tests for all new features
   - Include both positive and negative test cases
   - Mock external dependencies
   - Test error handling paths

2. **Test Organization**
   - Group tests by functionality
   - Use descriptive test names
   - Maintain test isolation
   - Clean up test resources

3. **Continuous Integration**
   - All tests must pass before merging
   - Maintain test coverage above 80%
   - Address test failures promptly
   - Regular test suite maintenance

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## MPC Integration Architecture

To enhance the privacy and security of sensitive operations like tool calls and agent interactions, this system can integrate Multi-Party Computation (MPC) using the CrypTen library. The proposed architecture involves the existing Frontend and Backend components, along with a dedicated MPC Server.

**Components:**

*   **Frontend UI (JS):** The user interface running in the browser.
*   **Backend API Server (FastAPI, Python):** The main server handling API requests, WebSocket connections, and standard logic. It also acts as a participant in the MPC protocol.
*   **Dedicated MPC Server (Python/CrypTen):** A separate server process responsible for participating in the CrypTen MPC computations.
*   **MPC Coordination Logic (Backend):** Handles the setup, initiation, and result retrieval of MPC sessions.

**Conceptual Flow Diagram:**

<p align="center">
  <img src="images/servers.png" alt="MPC Integration Architecture Diagram" width="700">
</p>

**Explanation of the Secure Flow:**

1.  The User interacts with the Frontend UI.
2.  For actions requiring secure computation, the Frontend JS sends a request to a designated endpoint on the Backend API server.
3.  The Backend API server receives the request and triggers its MPC Coordination Logic.
4.  The Coordination Logic initiates an MPC session using CrypTen, involving itself (as one party) and the dedicated MPC Server (as the other party/parties). The frontend's private input is securely incorporated.
5.  The Backend MPC Participant and the MPC Server(s) perform the secure computation using CrypTen's protocols.
6.  Once the MPC protocol completes, the secure result is available to the participating parties (primarily the Backend).
7.  The MPC Coordination logic provides the secure result back to the main Backend API logic.
8.  The Backend API server then proceeds with the non-sensitive part of the action (e.g., executing the tool using the secure result).
9.  Finally, the Backend sends the final response back to the Frontend UI.

This architecture allows leveraging CrypTen's capabilities for specific sensitive computations while keeping the main application flow intact for standard operations.