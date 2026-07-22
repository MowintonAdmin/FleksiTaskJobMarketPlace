"""Quick script to start the backend server from the FleksiTaskJobMarketPlace repo."""
import sys
import os

backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                            "FleksiTaskJobMarketPlace", "backend")
sys.path.insert(0, backend_path)
os.chdir(backend_path)

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)