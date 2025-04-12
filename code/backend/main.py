from fastapi import FastAPI, HTTPException, WebSocket, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import sqlite3
import json
import uuid
import asyncio
import random

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
def get_db():
    conn = sqlite3.connect('agents.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            goal TEXT NOT NULL,
            capabilities TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL,
            content TEXT NOT NULL,
            sender TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tools (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            available BOOLEAN NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database
init_db()

# Models
class Agent(BaseModel):
    id: str
    name: str
    role: str
    goal: str
    capabilities: List[str]
    status: str
    created_at: Optional[datetime] = None

class Message(BaseModel):
    id: Optional[int] = None
    agent_id: str
    content: str
    sender: str
    language_model: Optional[str] = "gpt-4"  # Default language model
    timestamp: Optional[datetime] = None

class Tool(BaseModel):
    id: str
    name: str
    description: str
    api_endpoint: str
    available: bool
    created_at: Optional[datetime] = None
    
class ToolUsage(BaseModel):
    tool_name: str
    input_data: str
    output_data: str
    
class ReasoningStep(BaseModel):
    step_number: int
    content: str
    
class ContextNode(BaseModel):
    type: str
    content: str
    
class EnhancedResponse(BaseModel):
    content: str
    tool_usage: Optional[ToolUsage] = None
    reasoning_steps: Optional[List[ReasoningStep]] = None
    context_chain: Optional[List[ContextNode]] = None

# API Endpoints
@app.get("/api/agents", response_model=List[Agent])
@app.head("/api/agents")
async def get_agents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agents")
    rows = cursor.fetchall()
    conn.close()
    
    agents = []
    for row in rows:
        agent = dict(row)
        agent['capabilities'] = json.loads(agent['capabilities'])
        agents.append(Agent(**agent))
    
    return agents

@app.get("/api/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = dict(row)
    agent['capabilities'] = json.loads(agent['capabilities'])
    return Agent(**agent)

@app.get("/api/tools", response_model=List[Tool])
@app.head("/api/tools")
async def get_tools():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tools")
    rows = cursor.fetchall()
    conn.close()
    
    return [Tool(**dict(row)) for row in rows]

@app.get("/api/agents/{agent_id}/messages", response_model=List[Message])
async def get_agent_messages(agent_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages WHERE agent_id = ? ORDER BY timestamp", (agent_id,))
    rows = cursor.fetchall()
    conn.close()
    
    return [Message(**dict(row)) for row in rows]

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, agent_id: str):
        await websocket.accept()
        if agent_id not in self.active_connections:
            self.active_connections[agent_id] = []
        self.active_connections[agent_id].append(websocket)
        print(f"New connection for agent {agent_id}. Total connections: {len(self.active_connections[agent_id])}")

    def disconnect(self, websocket: WebSocket, agent_id: str):
        if agent_id in self.active_connections and websocket in self.active_connections[agent_id]:
            self.active_connections[agent_id].remove(websocket)
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]
            print(f"Connection closed for agent {agent_id}. Remaining connections: {len(self.active_connections.get(agent_id, []))}")

    async def broadcast_to_agent(self, agent_id: str, message: dict):
        if agent_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[agent_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message to connection: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for dead_conn in dead_connections:
                if dead_conn in self.active_connections[agent_id]:
                    self.active_connections[agent_id].remove(dead_conn)

manager = ConnectionManager()

@app.websocket("/ws/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    await manager.connect(websocket, agent_id)
    try:
        # Send initial welcome message
        try:
            # Find the agent name
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM agents WHERE id = ?", (agent_id,))
            row = cursor.fetchone()
            conn.close()
            
            agent_name = row['name'] if row else "Agent"
            
            await websocket.send_json({
                "type": "system",
                "content": f"Connected to {agent_name}. How can I help you today?",
                "message_type": "info"
            })
        except Exception as e:
            print(f"Error sending welcome message: {e}")
        
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                print(f"Received WebSocket message: {message_data}")
                
                if 'type' in message_data and message_data['type'] == 'message':
                    # Create message model
                    message = Message(
                        agent_id=agent_id,
                        content=message_data['content'],
                        sender='user'
                    )
                    
                    # Process message and get response
                    response = await create_message(agent_id, message)
                    
                    # Send response back through WebSocket
                    await websocket.send_json({
                        'type': 'message',
                        'content': response.content,
                        'sender': 'agent',
                        'tool_usage': response.tool_usage.dict() if response.tool_usage else None,
                        'reasoning_steps': [step.dict() for step in response.reasoning_steps] if response.reasoning_steps else None,
                        'context_chain': [node.dict() for node in response.context_chain] if response.context_chain else None
                    })
            except Exception as e:
                print(f"Error processing WebSocket message: {e}")
                try:
                    await websocket.send_json({
                        'type': 'system',
                        'content': f"Error processing your message: {str(e)}",
                        'message_type': 'error'
                    })
                except:
                    pass
    except Exception as e:
        print(f"WebSocket connection error: {e}")
    finally:
        manager.disconnect(websocket, agent_id)

@app.post("/api/agents/{agent_id}/reset")
async def reset_agent_chat(agent_id: str):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Delete all messages for this agent
        cursor.execute("DELETE FROM messages WHERE agent_id = ?", (agent_id,))
        conn.commit()
        
        # Broadcast reset event to all connected clients
        if manager.active_connections.get(agent_id):
            await manager.broadcast_to_agent(agent_id, {
                'type': 'reset',
                'message': 'Chat has been reset'
            })
        
        return {"success": True, "message": "Chat reset successfully"}
    except Exception as e:
        print(f"Error resetting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/agents/{agent_id}/messages", response_model=EnhancedResponse)
async def create_message(agent_id: str, message: Message):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Store user message
        cursor.execute(
            "INSERT INTO messages (agent_id, content, sender) VALUES (?, ?, ?)",
            (agent_id, message.content, message.sender)
        )
        message_id = cursor.lastrowid
        
        # Check if tool usage request
        tool_usage = None
        reasoning_steps = None
        context_chain = None
        
        # Get the language model to use
        language_model = message.language_model or "gpt-4"
        
        # Log which model we're using for debugging purposes
        print(f"Using language model: {language_model}")
        
        if any(keyword in message.content.lower() for keyword in ["use tool", "using the", "tool", "search for"]):
            # Try to identify which tool to use
            tool_match = None
            conn_tools = get_db()
            cursor_tools = conn_tools.cursor()
            cursor_tools.execute("SELECT * FROM tools")
            tools = [Tool(**dict(row)) for row in cursor_tools.fetchall()]
            conn_tools.close()
            
            # Look for tool name in message
            for tool in tools:
                if tool.name.lower() in message.content.lower():
                    tool_match = tool
                    break
            
            # If we found a matching tool
            if tool_match:
                # Generate tool usage response
                tool_input = extract_input_from_message(message.content)
                tool_output = execute_tool(tool_match, tool_input)
                
                tool_usage = ToolUsage(
                    tool_name=tool_match.name,
                    input_data=tool_input,
                    output_data=tool_output
                )
                
                # Add reasoning steps
                reasoning_steps = generate_reasoning_steps(tool_match, tool_input)
                
                # Add context chain
                context_chain = [
                    ContextNode(type="User Request", content=message.content),
                    ContextNode(type="Language Model", content=f"Using model: {language_model}"),
                    ContextNode(type="Tool Selection", content=f"Selected tool: {tool_match.name}"),
                    ContextNode(type="Tool Result", content=f"Result: {tool_output[:50]}...")
                ]
                
                # Generate response content with tool usage
                response_content = generate_tool_response(tool_match, tool_input, tool_output)
            else:
                # No specific tool mentioned, generate a general response
                response_content = generate_response(message.content)
        else:
            # Regular response (no tool usage)
            response_content = generate_response(message.content)
            
            # Add model information to context
            context_chain = [
                ContextNode(type="User Request", content=message.content),
                ContextNode(type="Language Model", content=f"Using model: {language_model}")
            ]
            
            # Occasionally add reasoning steps for regular responses too
            if random.random() < 0.3:  # 30% chance
                reasoning_steps = [
                    ReasoningStep(step_number=1, content="Analyze the user's request"),
                    ReasoningStep(step_number=2, content="Identify the key information needed"),
                    ReasoningStep(step_number=3, content="Formulate a clear and helpful response")
                ]
        
        # Store agent response
        cursor.execute(
            "INSERT INTO messages (agent_id, content, sender) VALUES (?, ?, ?)",
            (agent_id, response_content, 'agent')
        )
        
        conn.commit()
        
        # Create enhanced response
        response = EnhancedResponse(
            content=response_content,
            tool_usage=tool_usage,
            reasoning_steps=reasoning_steps,
            context_chain=context_chain
        )
        
        return response
    except Exception as e:
        print(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/agents/{agent_id}/status")
async def update_agent_status(agent_id: str, status: str = Body(..., embed=True)):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Validate status
        if status not in ['active', 'idle']:
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'idle'")
        
        # Update agent status
        cursor.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent_id))
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Agent not found")
        
        conn.commit()
        
        # Broadcast status update if there are websocket connections for this agent
        if manager.active_connections.get(agent_id):
            await manager.broadcast_to_agent(agent_id, {
                'type': 'system',
                'content': f"Agent status changed to {status}",
                'message_type': 'info'
            })
        
        return {"success": True, "message": f"Agent {agent_id} status updated to {status}"}
    except Exception as e:
        if not isinstance(e, HTTPException):  # Don't catch HTTPExceptions
            print(f"Error updating agent status: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        raise
    finally:
        conn.close()

def extract_input_from_message(message: str) -> str:
    # Extract potential input data from user message
    # This is a simple implementation - in a real system you'd have more sophisticated parsing
    message = message.lower()
    
    # Remove tool request phrases
    message = message.replace("please use the", "")
    message = message.replace("tool to help me", "")
    message = message.replace("could you use", "")
    message = message.replace("using the", "")
    
    # Remove known tool names to get the actual query
    for tool_name in ["web search", "code analysis", "text processing", "database", 
                      "file system", "api", "calculator", "weather", "translation"]:
        message = message.replace(tool_name, "")
    
    # Clean up the result
    message = message.strip()
    
    # If message is too short after cleanup, return a placeholder
    if len(message) < 5:
        message = "sample input data"
    
    return message

def execute_tool(tool: Tool, input_data: str) -> str:
    """Simulated tool execution"""
    
    tool_outputs = {
        "Web Search": [
            "Found 5 relevant results. The most relevant information indicates that...",
            "Search complete. According to the top results from reputable sources...",
            "Search results show that most experts agree on this topic that..."
        ],
        "Code Analysis": [
            "Analysis complete. Found 2 potential bugs and 3 optimization opportunities.",
            "Code reviewed successfully. Main issues identified: inconsistent error handling and unused variables.",
            "Code quality score: 78%. Recommendations: improve documentation and add more test coverage."
        ],
        "Text Processing": [
            "Text processed successfully. Summary: The document discusses the main principles of machine learning with focus on neural networks.",
            "Analysis complete. Sentiment: Positive (78%). Key topics: technology, innovation, future trends.",
            "Processing complete. Word count: 1,247. Reading time: ~6 minutes. Complexity level: Intermediate."
        ],
        "Database": [
            "Query executed successfully. Retrieved 42 records matching your criteria.",
            "Database operation complete. Updated 17 records. All constraints satisfied.",
            "Database analysis shows normalized tables with proper indexing. Performance optimization suggested for queries on the users table."
        ],
        "File System": [
            "File operation successful. Created directory structure with proper permissions.",
            "File scan complete. Found 24 files matching the pattern. Total size: 156MB.",
            "File system analysis shows 78% disk usage. Largest directories: /media (45GB), /backups (23GB)."
        ],
        "API": [
            "API request successful. Response received with status code 200.",
            "API integration complete. Successfully connected and authenticated with the service.",
            "API usage analysis: 1,242 calls this month, 78% GET requests, 22% POST requests."
        ],
        "Calculator": [
            "Calculation complete. Result: 1,247.89",
            "Mathematical analysis finished. The equation is solvable with 3 distinct roots.",
            "Statistical analysis: Mean: 78.2, Median: 75.5, Standard Deviation: 12.4"
        ],
        "Weather": [
            "Current weather in New York: 72°F, Partly Cloudy, Humidity: 65%",
            "Weather forecast obtained. Next 3 days: Sunny (78°F), Rain (65°F), Cloudy (70°F)",
            "Climate data analyzed. This region shows a 2.4°C increase in average temperature over the last decade."
        ],
        "Translation": [
            "Translation complete. Original (Spanish): 'Hola mundo', Translated (English): 'Hello world'",
            "Translation services accessed. 500 words translated from German to English.",
            "Multilingual analysis complete. Document contains 78% English, 15% Spanish, 7% French."
        ]
    }
    
    # Get default outputs for unknown tools
    default_outputs = [
        f"Tool '{tool.name}' executed successfully with input: {input_data}",
        f"Processed input using {tool.name} tool. Results indicate positive outcomes.",
        f"Operation completed using {tool.name}. Generated comprehensive analysis based on input criteria."
    ]
    
    # Get possible outputs for this tool or use defaults
    possible_outputs = tool_outputs.get(tool.name, default_outputs)
    
    # Select a random output
    return random.choice(possible_outputs)

def generate_reasoning_steps(tool: Tool, input_data: str) -> List[ReasoningStep]:
    """Generate reasoning steps for tool usage"""
    
    return [
        ReasoningStep(
            step_number=1, 
            content=f"Analyzed user request and identified need for {tool.name}"
        ),
        ReasoningStep(
            step_number=2, 
            content=f"Prepared input data: '{input_data}' for processing"
        ),
        ReasoningStep(
            step_number=3, 
            content=f"Executed {tool.name} and obtained results"
        ),
        ReasoningStep(
            step_number=4, 
            content="Formulated response based on tool output"
        )
    ]

def generate_tool_response(tool: Tool, input_data: str, output_data: str) -> str:
    """Generate a response that includes tool usage information"""
    
    response_templates = [
        f"I used the {tool.name} tool to help with your request. Using the input: '{input_data}', I found the following:\n\n{output_data}\n\nIs there anything specific from these results you'd like me to explain further?",
        
        f"To answer your question, I used the {tool.name} tool. Here's what I found:\n\nInput: {input_data}\nOutput: {output_data}\n\nBased on these results, I can help you understand the details if needed.",
        
        f"I've utilized the {tool.name} tool to address your request. With the input '{input_data}', the tool provided this output:\n\n{output_data}\n\nWould you like me to elaborate on any aspect of these findings?",
        
        f"Using tool: {tool.name}\nInput: {input_data}\nOutput: {output_data}\n\nThese results should help address your question. Let me know if you need further assistance interpreting this information."
    ]
    
    return random.choice(response_templates)

def generate_response(user_message: str) -> str:
    # Simple response generation based on user message
    responses = [
        "I understand your message. Let me help you with that.",
        "That's an interesting point. Here's what I think...",
        "I've analyzed your request and here's my response.",
        "Based on your input, I would suggest...",
        "Let me process that and provide a suitable response.",
        "Thanks for your message. I can definitely assist with that.",
        "I've considered your question carefully. My analysis suggests...",
        "Interesting question! From my understanding..."
    ]
    
    # Add a more specific first part sometimes
    specifics = [
        f"Regarding your question about '{user_message[:20]}...', ",
        f"About your request for information on '{user_message[:20]}...', ",
        f"Concerning your inquiry about '{user_message[:20]}...', ",
        f"In response to your question about '{user_message[:20]}...', "
    ]
    
    # 50% chance to add a specific prefix
    if random.random() > 0.5:
        return random.choice(specifics) + random.choice(responses)
    else:
        return random.choice(responses)

# Initialize sample data
def initialize_sample_data():
    conn = get_db()
    cursor = conn.cursor()
    
    # Sample agents
    agents = [
        {
            'id': '1',
            'name': 'Research Assistant',
            'role': 'Academic Research',
            'goal': 'Help with research tasks and literature review',
            'capabilities': json.dumps(['Literature Review', 'Data Analysis', 'Citation Management']),
            'status': 'active'
        },
        {
            'id': '2',
            'name': 'Code Helper',
            'role': 'Programming Assistant',
            'goal': 'Assist with coding tasks and debugging',
            'capabilities': json.dumps(['Code Review', 'Debugging', 'Best Practices']),
            'status': 'active'
        },
        {
            'id': '3',
            'name': 'Writing Assistant',
            'role': 'Content Creation',
            'goal': 'Help with writing and editing tasks',
            'capabilities': json.dumps(['Grammar Check', 'Style Editing', 'Content Planning']),
            'status': 'idle'
        }
    ]
    
    # Sample tools
    tools = [
        {
            'id': '1',
            'name': 'Web Search',
            'description': 'Search the web for information',
            'api_endpoint': '/api/tools/search',
            'available': True
        },
        {
            'id': '2',
            'name': 'Code Analysis',
            'description': 'Analyze code for bugs and optimizations',
            'api_endpoint': '/api/tools/code',
            'available': True
        },
        {
            'id': '3',
            'name': 'Text Processing',
            'description': 'Analyze, summarize, or translate text',
            'api_endpoint': '/api/tools/text',
            'available': True
        }
    ]
    
    # Check if we already have data
    cursor.execute("SELECT COUNT(*) as count FROM agents")
    if cursor.fetchone()['count'] == 0:
        # Insert agents
        for agent in agents:
            cursor.execute(
                "INSERT INTO agents (id, name, role, goal, capabilities, status) VALUES (?, ?, ?, ?, ?, ?)",
                (agent['id'], agent['name'], agent['role'], agent['goal'], agent['capabilities'], agent['status'])
            )
        
        # Insert tools
        for tool in tools:
            cursor.execute(
                "INSERT INTO tools (id, name, description, api_endpoint, available) VALUES (?, ?, ?, ?, ?)",
                (tool['id'], tool['name'], tool['description'], tool['api_endpoint'], tool['available'])
            )
        
        conn.commit()
        print("Sample data initialized")
    
    conn.close()

# Initialize sample data on startup
initialize_sample_data()

# Add available models endpoint
@app.get("/api/models")
async def get_available_models():
    # In a real system, this might be fetched from a config file or database
    return [
        {"id": "gpt-4", "name": "GPT-4", "description": "OpenAI's most powerful model for complex tasks", "provider": "OpenAI"},
        {"id": "gemini-2-5", "name": "Gemini 2.5", "description": "Google's multimodal model with wide capabilities", "provider": "Google"},
        {"id": "claude-3", "name": "Claude 3", "description": "Anthropic's advanced assistant model", "provider": "Anthropic"},
        {"id": "llama-3", "name": "LLaMA 3", "description": "Meta's open model for various applications", "provider": "Meta"}
    ]

# Add metrics endpoint
@app.get("/api/metrics")
async def get_metrics():
    """Get system metrics for the dashboard"""
    try:
        # Get count of active agents
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM agents WHERE status = 'active'")
        active_agents = cursor.fetchone()['count']
        
        # Get total number of messages as a proxy for tasks
        cursor.execute("SELECT COUNT(*) as count FROM messages WHERE sender = 'user'")
        total_tasks = cursor.fetchone()['count']
        
        # Get count of active tasks (assume 30% of total tasks are active)
        active_tasks = max(1, int(total_tasks * 0.3))
        
        conn.close()
        
        # Generate simulated metrics
        return {
            "active_agents": active_agents,
            "active_tasks": active_tasks,
            "system_load": random.randint(20, 85),
            "response_time": random.randint(50, 500),
            "success_rate": random.randint(85, 99),
            "tasks_completed": max(0, total_tasks - active_tasks),
            "active_sessions": random.randint(1, 10)
        }
    except Exception as e:
        print(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add tasks endpoint
@app.get("/api/tasks")
async def get_tasks():
    """Get recent tasks for the dashboard"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get user messages as tasks
        cursor.execute("""
            SELECT m.id, m.agent_id, m.content as input, m.timestamp as created_at,
                   a.name as agent_name
            FROM messages m
            JOIN agents a ON m.agent_id = a.id
            WHERE m.sender = 'user'
            ORDER BY m.timestamp DESC
            LIMIT 10
        """)
        
        tasks = []
        for row in cursor.fetchall():
            task = dict(row)
            
            # Generate random status
            statuses = ["completed", "in_progress", "pending", "failed"]
            weights = [0.6, 0.2, 0.1, 0.1]  # 60% completed, 20% in progress, etc.
            task["status"] = random.choices(statuses, weights=weights, k=1)[0]
            
            # Add result or error based on status
            if task["status"] == "completed":
                task["result"] = f"Task completed successfully. Output prepared for {task['agent_name']}."
            elif task["status"] == "failed":
                task["error"] = "Error processing task: insufficient parameters provided."
            
            tasks.append(task)
            
        conn.close()
        
        return tasks
    except Exception as e:
        print(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 