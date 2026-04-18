import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

async def test():
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Hello, are you active?"
        )
        print(f"Success: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
