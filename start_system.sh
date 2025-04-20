#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Multi-Agent AI System...${NC}"

# Create a directory for log files
mkdir -p logs

# 1. Start the MCP Server
echo -e "${GREEN}Starting MCP Server...${NC}"
cd code/mcp_server
python server.py > ../../logs/mcp_server.log 2>&1 &
MCP_SERVER_PID=$!
echo "MCP Server started with PID: $MCP_SERVER_PID"
cd ../..

# Wait for MCP Server to initialize
sleep 2

# 2. Start the MCP Client
echo -e "${GREEN}Starting MCP Client...${NC}"
cd code/mcp_client
python client.py > ../../logs/mcp_client.log 2>&1 &
MCP_CLIENT_PID=$!
echo "MCP Client started with PID: $MCP_CLIENT_PID"
cd ../..

# Wait for MCP Client to initialize
sleep 2

# 3. Start the Backend Server (main.py)
echo -e "${GREEN}Starting Backend Server...${NC}"
cd code/backend
python main.py > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ../..
echo "Backend Server started with PID: $BACKEND_PID"

# Wait for Backend to initialize
sleep 2

# 4. Start the Frontend Server
echo -e "${GREEN}Starting Frontend Server...${NC}"
cd code/frontend
# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start the frontend server
npm start > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..
echo "Frontend Server started with PID: $FRONTEND_PID"

echo -e "${BLUE}All components started!${NC}"
echo -e "${GREEN}You can access the application at: http://localhost:3000${NC}"
echo "To view logs:"
echo "  MCP Server: tail -f logs/mcp_server.log"
echo "  MCP Client: tail -f logs/mcp_client.log"
echo "  Backend: tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"

# Create a stop script
cat > stop_system.sh << 'EOL'
#!/bin/bash
echo "Stopping all components..."
kill $(ps aux | grep '[p]ython code/mcp_server/server.py' | awk '{print $2}')
kill $(ps aux | grep '[p]ython code/mcp_client/client.py' | awk '{print $2}')
kill $(ps aux | grep '[p]ython code/backend/main.py' | awk '{print $2}')
kill $(ps aux | grep '[n]pm start' | awk '{print $2}')
echo "All components stopped!"
EOL

chmod +x stop_system.sh
echo -e "${BLUE}Created stop_system.sh script to stop all components${NC}"

# Keep the script running and show logs
echo -e "${BLUE}Showing combined logs (Ctrl+C to exit):${NC}"
tail -f logs/*.log 