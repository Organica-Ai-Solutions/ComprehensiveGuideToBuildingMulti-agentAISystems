#!/bin/bash
echo "Stopping all components..."
kill $(ps aux | grep '[p]ython code/mcp_server/server.py' | awk '{print $2}')
kill $(ps aux | grep '[p]ython code/mcp_client/client.py' | awk '{print $2}')
kill $(ps aux | grep '[p]ython code/backend/main.py' | awk '{print $2}')
kill $(ps aux | grep '[n]pm start' | awk '{print $2}')
echo "All components stopped!"
