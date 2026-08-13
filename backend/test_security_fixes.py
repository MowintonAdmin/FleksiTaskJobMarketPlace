import urllib.request
import urllib.parse
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_path_traversal():
    print("=== 1. Testing Path Traversal Protection ===")
    
    # 1. Test /media/../../.env
    url = f"{BASE_URL}/media/../../.env"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            print("❌ Path Traversal FAILED: /media/../../.env returned status", resp.getcode())
    except urllib.error.HTTPError as e:
        if e.code == 400:
            print("✅ Path Traversal PASS: /media/../../.env correctly blocked with 400 Bad Request!")
        else:
            print(f"✅ Path Traversal PASS: /media/../../.env returned {e.code}")
    except Exception as e:
        print("Path Traversal Exception:", e)

def test_magic_bytes_validation():
    print("\n=== 2. Testing Magic Bytes Validation Logic ===")
    from app.core.file_validation import validate_image_magic_bytes
    from fastapi import HTTPException

    # 1. Valid JPEG
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    ext = validate_image_magic_bytes(jpeg_bytes, "test.jpg")
    print(f"✅ Valid JPEG Magic Bytes PASS: Detected ext '{ext}'")

    # 2. Valid PNG
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    ext = validate_image_magic_bytes(png_bytes, "test.png")
    print(f"✅ Valid PNG Magic Bytes PASS: Detected ext '{ext}'")

    # 3. Spoofed Python script disguised as test.jpg
    fake_script = b"import os\nos.system('echo HACKED')\nprint('malicious code')"
    try:
        validate_image_magic_bytes(fake_script, "test.jpg")
        print("❌ Magic Bytes FAILED: Fake script was incorrectly allowed!")
    except HTTPException as e:
        print(f"✅ Magic Bytes PASS: Fake script disguised as test.jpg was correctly REJECTED with status {e.status_code} ({e.detail})!")

if __name__ == "__main__":
    test_path_traversal()
    test_magic_bytes_validation()
