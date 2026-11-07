# Test script for WebSocket ACK round-trip latency
import asyncio
import time
import cv2
import numpy as np

async def test_ack_latency():
    import websockets
    # Generate a small test frame (640x360)
    img = np.zeros((360, 640, 3), dtype=np.uint8)
    cv2.putText(img, "TEST", (200, 180), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 52])
    frame_bytes = buf.tobytes()
    print(f"Test frame payload size: {len(frame_bytes)} bytes (~{len(frame_bytes)/1024:.1f} KB)")

    uri = "ws://127.0.0.1:8000/ws/stream/cam1"
    async with websockets.connect(uri) as ws:
        # Ignore initial record_status message
        init_msg = await ws.recv()
        print("Connected. Received initial status.")

        latencies = []
        for i in range(10):
            t0 = time.perf_counter()
            await ws.send(frame_bytes)
            ack = await ws.recv()
            t1 = time.perf_counter()
            rtt_ms = (t1 - t0) * 1000
            latencies.append(rtt_ms)
            assert ack == b"\x06", f"Expected b'\\x06', got {ack}"
            await asyncio.sleep(0.033) # 30 FPS interval

        avg_latency = sum(latencies) / len(latencies)
        print(f"ACK Latencies over 10 frames (ms): {[round(x, 2) for x in latencies]}")
        print(f"Average Round-Trip Latency: {avg_latency:.2f} ms")
        assert avg_latency < 30.0, f"Latency too high: {avg_latency} ms"
        print("✓ Ultra-Low Latency Verification PASSED!")

if __name__ == "__main__":
    asyncio.run(test_ack_latency())
