import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8765))
MODEL = "claude-sonnet-4-20250514"
