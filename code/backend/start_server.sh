#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set environment variables
export FLASK_APP=main.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Start the Flask server
python -m flask run --host=0.0.0.0 --port=5000 