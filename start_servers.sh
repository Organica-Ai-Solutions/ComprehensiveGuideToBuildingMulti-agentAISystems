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
export FLASK_APP=main.py
export FLASK_ENV=development
export FLASK_DEBUG=1
python -m flask run --host=0.0.0.0 --port=5000 &
cd ../..

# Start frontend server
cd code/frontend
npm install
npm start &

# Wait for both servers
echo "Servers started!"
echo "Frontend running on http://localhost:3000"
echo "Backend running on http://localhost:5000"
echo "Press Ctrl+C to stop both servers"

# Keep script running
wait 