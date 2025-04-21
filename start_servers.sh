#!/bin/bash

# Function to stop servers on script termination
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up cleanup on script termination
trap cleanup EXIT INT TERM

echo "Starting servers..."

# Start backend server
cd code/backend
if [ -d "venv" ]; then
    source venv/bin/activate
fi
python3 main.py --port 5001 &

# Wait a bit for the backend to start
sleep 2

# Start frontend server
cd ../frontend
npm install
npm start &

# Wait for both servers
echo "Servers started!"
echo "Frontend running on http://localhost:3000"
echo "Backend running on http://localhost:5001"
echo "Press Ctrl+C to stop both servers"

# Keep script running
wait 