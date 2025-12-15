#!/bin/bash
# OpenMuse Backend Server Startup Script

cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt --quiet

if [ ! -f "../.env" ]; then
    echo ""
    echo "WARNING: No .env file found!"
    echo "Please copy .env.example to .env and add your Anthropic API key:"
    echo "  cp .env.example .env"
    echo ""
fi

echo ""
echo "Starting OpenMuse server..."
echo "Server will be available at http://127.0.0.1:8765"
echo ""
python server.py
