"""
Verification test: Connect to web_studio_server as a phone (on HTTPS port 8088)
and as a viewer (on HTTP port 8000), send camera frame, verify viewer receives 3D pose.
"""
import sys
import json
import asyncio
import numpy as np
import cv2
import websockets
import ssl

async def test_stream():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    uri_viewer = "ws://127.0.0.1:8000/ws/viewer"
    uri_phone = "wss://127.0.0.1:8088/ws/stream/cam1"

    print("[*] Connecting viewer WebSocket (HTTP port 8000)...")
    viewer_ws = await websockets.connect(uri_viewer)
    print("[+] Viewer connected successfully!")

    print("[*] Connecting phone WebSocket (HTTPS port 8088)...")
    phone_ws = await websockets.connect(uri_phone, ssl=ssl_context)
    print("[+] Phone connected successfully!")

    # Create dummy camera frame
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(test_frame, (320, 100), 40, (255, 255, 255), -1)
    cv2.line(test_frame, (320, 140), (320, 300), (255, 255, 255), 15)
    cv2.line(test_frame, (320, 180), (220, 240), (255, 255, 255), 10)
    cv2.line(test_frame, (320, 180), (420, 240), (255, 255, 255), 10)
    cv2.line(test_frame, (320, 300), (260, 420), (255, 255, 255), 12)
    cv2.line(test_frame, (320, 300), (380, 420), (255, 255, 255), 12)

    _, buf = cv2.imencode(".jpg", test_frame)
    jpeg_bytes = buf.tobytes()

    print(f"[*] Sending test camera frame ({len(jpeg_bytes)} bytes) from phone...")
    await phone_ws.send(jpeg_bytes)

    print("[*] Awaiting 3D pose broadcast on viewer WebSocket...")
    try:
        msg = await asyncio.wait_for(viewer_ws.recv(), timeout=4.0)
        pose_data = json.loads(msg)
        print("[+] SUCCESS! Received pose data on viewer:")
        print(f"    - Root position: {pose_data.get('rootPosition', [])}")
        print(f"    - Head data: {pose_data.get('head', {})}")
        print(f"    - Joints count: {len(pose_data.get('joints', {}))}")
    except asyncio.TimeoutError:
        print("[!] Timeout waiting for pose broadcast")
        sys.exit(1)

    await phone_ws.close()
    await viewer_ws.close()
    print("[+] All stream verification tests PASSED!")

if __name__ == "__main__":
    asyncio.run(test_stream())
