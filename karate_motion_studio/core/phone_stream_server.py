"""
Phone Stream Server for Karate Motion Studio.
Enables using one or multiple smartphones (iPhone / Android) as wireless HD cameras
without installing any mobile apps — just scan a QR code in the local Wi-Fi network!
Supports SSL (HTTPS / WSS) for mobile browser security and camera access.
"""
from __future__ import annotations
import os
import sys
import io
import time
import json
import asyncio
import socket
import threading
from contextlib import asynccontextmanager
from typing import Dict, Optional, Callable, List, Tuple, Any, Set
from pathlib import Path
import numpy as np
import cv2

try:
    import qrcode
    from PIL import Image
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response


def get_local_ip() -> str:
    """Finds the local network IP of the host machine on the Wi-Fi / LAN."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Does not actually send data over wire, just identifies outbound interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def generate_self_signed_cert(cert_path: Path, key_path: Path, host_ip: str) -> bool:
    """Generates a self-signed RSA-2048 X.509 certificate with Subject Alternative Names for local Wi-Fi mocap."""
    try:
        import datetime
        import ipaddress
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        cert_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.parent.mkdir(parents=True, exist_ok=True)

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        key_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        key_path.write_bytes(key_pem)

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "RU"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Karate Motion Studio"),
            x509.NameAttribute(NameOID.COMMON_NAME, host_ip),
        ])

        san_list = [
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        ]
        # Include active IP and known interfaces in SAN
        for ip_cand in [host_ip, "192.168.100.28", "192.168.100.6", "192.168.218.1", "192.168.241.1", "192.168.56.1", "172.28.224.1"]:
            if not ip_cand:
                continue
            try:
                ip_obj = x509.IPAddress(ipaddress.IPv4Address(ip_cand))
                if ip_obj not in san_list:
                    san_list.append(ip_obj)
            except ValueError:
                dns_obj = x509.DNSName(ip_cand)
                if dns_obj not in san_list:
                    san_list.append(dns_obj)

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
            .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3650))
            .add_extension(
                x509.SubjectAlternativeName(san_list),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )
        cert_pem = cert.public_bytes(serialization.Encoding.PEM)
        cert_path.write_bytes(cert_pem)
        return True
    except Exception as e:
        print(f"Warning: Failed to generate self-signed SSL cert via cryptography: {e}")
        try:
            import subprocess
            cmd = [
                "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(key_path),
                "-out", str(cert_path),
                "-days", "3650",
                "-subj", f"/C=RU/O=BunkaiExplorer/CN={host_ip}",
                "-addext", f"subjectAltName = DNS:localhost,IP:127.0.0.1,IP:{host_ip},IP:192.168.100.28,IP:192.168.100.6"
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return True
        except Exception as oe:
            print(f"Warning: Failed openssl fallback cert generation: {oe}")
            return False


MOBILE_CLIENT_HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0c0a09">
  <title>Bunkai Explorer — Камера Додзё</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=Noto+Serif+JP:wght@600;700&display=swap">
  <style>
    :root {
      --bg-canvas: #0c0a09;
      --bg-surface: #151310;
      --bg-subtle: #1c1814;
      --bg-hover: #26211c;
      --border: #2e261f;
      --border-subtle: #231c16;
      --wood-border: #352b22;

      --text: #f6f3ec;
      --text-secondary: #cec7b9;
      --text-muted: #91897c;

      --gold: #c29f55;
      --gold-soft: #d4b778;
      --gold-bright: #e4ce95;
      --gold-dark: #8a6c2f;
      --gold-border: #52432e;
      --gold-glow: rgba(194, 159, 85, 0.25);

      --accent-red: #ba1d1d;
      --accent-red-hover: #d32f2f;
      --hanko-bg: #a81c1c;
      --hanko-border: #dc2626;
      --crimson-glow: rgba(186, 29, 29, 0.35);

      --success: #318a5d;
      --theme-color: #c29f55;
      --theme-glow: rgba(194, 159, 85, 0.26);

      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-display: 'Cinzel', 'Noto Serif JP', Georgia, serif;
      --font-kanji: 'Noto Serif JP', serif;
    }
    body[data-role="cam2"] {
      --theme-color: #5b8fd9;
      --theme-glow: rgba(91, 143, 217, 0.28);
    }
    body[data-role="cam3"] {
      --theme-color: #d96b43;
      --theme-glow: rgba(217, 107, 67, 0.28);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body {
      background: var(--bg-canvas);
      background-image:
        radial-gradient(ellipse at 50% 0%, rgba(194, 159, 85, 0.045) 0%, transparent 70%),
        linear-gradient(180deg, #0e0c0a 0%, #0c0a09 100%);
      color: var(--text);
      font-family: var(--font-sans);
      overflow: hidden;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      touch-action: manipulation;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation Bar (Dojo Header Style) */
    header {
      position: relative;
      background: rgba(18, 15, 12, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: max(10px, env(safe-area-inset-top)) 14px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      z-index: 40;
    }
    header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, var(--gold-border) 20%, var(--gold) 50%, var(--gold-border) 80%, transparent 100%);
      opacity: 0.85;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }
    .brand-seal {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1f1a14 0%, #14110d 100%);
      border: 1px solid var(--gold-border);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.55), 0 0 10px rgba(194, 159, 85, 0.16);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }
    .brand-hanko {
      width: 24px;
      height: 24px;
      border-radius: 3px;
      background: linear-gradient(135deg, var(--hanko-bg) 0%, var(--accent-red) 100%);
      border: 1px solid rgba(228, 206, 149, 0.45);
      color: #ffffff;
      font-family: var(--font-kanji);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .brand-title {
      font-family: var(--font-display);
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-subtitle {
      font-size: 9.5px;
      color: var(--gold-soft);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
    }

    .header-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .role-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 4px;
      background: var(--bg-subtle);
      border: 1px solid var(--theme-color);
      color: var(--text);
      letter-spacing: 0.03em;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    .role-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--theme-color);
      box-shadow: 0 0 6px var(--theme-color);
      flex-shrink: 0;
    }
    .status-badge {
      font-size: 10.5px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 4px;
      background: var(--bg-surface);
      border: 1px solid var(--wood-border);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.25s ease;
    }
    .status-badge.live {
      background: linear-gradient(135deg, var(--hanko-bg) 0%, var(--accent-red) 100%);
      border-color: var(--hanko-border);
      color: #ffffff;
      box-shadow: 0 0 12px var(--crimson-glow);
      animation: pulseLive 1.8s infinite;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gold);
    }
    .status-badge.live .status-dot {
      background: #ffffff;
    }

    @keyframes pulseLive {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.88; transform: scale(0.97); }
    }

    /* Warning banner for HTTP vs HTTPS */
    .insecure-alert {
      background: linear-gradient(135deg, #8b1616 0%, #ba1d1d 100%);
      color: #f6f3ec;
      padding: 10px 14px;
      font-size: 12px;
      text-align: center;
      display: none;
      font-weight: 500;
      line-height: 1.45;
      z-index: 50;
      border-bottom: 1px solid var(--gold-border);
    }
    .insecure-alert a {
      color: var(--gold-bright);
      font-weight: 700;
      text-decoration: underline;
    }

    /* Viewport Container */
    .viewport {
      flex: 1;
      position: relative;
      background: #080706;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border-left: 2px solid transparent;
      border-right: 2px solid transparent;
      transition: border-color 0.3s ease;
    }
    body.is-live .viewport {
      border-color: var(--gold-border);
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform-origin: center center;
    }
    video.mirrored {
      transform: scaleX(-1);
    }
    canvas { display: none; }

    /* Stance Alignment Grid Overlay (Shoji / Kumiko subtle grid) */
    .grid-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      opacity: 0.24;
      transition: opacity 0.2s;
    }
    .grid-overlay.hidden { display: none; }
    .grid-overlay div {
      border: 1px dashed rgba(194, 159, 85, 0.55);
    }
    .crosshair-center {
      position: absolute;
      width: 58px;
      height: 58px;
      border: 1px solid var(--gold);
      border-radius: 50%;
      opacity: 0.42;
      pointer-events: none;
      box-shadow: inset 0 0 8px rgba(194, 159, 85, 0.15);
    }

    /* Floating On-Screen HUD */
    .floating-hud {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      pointer-events: none;
      z-index: 20;
    }
    .hud-chips {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .hud-chip {
      background: rgba(18, 15, 12, 0.84);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 4px 9px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      border: 1px solid var(--wood-border);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
    }
    .hud-chip strong {
      color: var(--gold-soft);
      font-weight: 700;
    }

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: auto;
    }
    .circle-btn {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      background: rgba(21, 19, 16, 0.88);
      border: 1px solid var(--wood-border);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      transition: all 0.18s ease;
    }
    .circle-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.9;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .circle-btn:active {
      transform: scale(0.93);
      background: var(--bg-hover);
    }
    .circle-btn.active {
      background: linear-gradient(135deg, var(--gold-dark) 0%, var(--gold) 100%);
      color: #120e0b;
      border-color: var(--gold-bright);
      box-shadow: 0 2px 12px var(--gold-glow);
    }

    /* Role Guidance Banner at bottom of viewport */
    .role-guide-banner {
      position: absolute;
      bottom: 10px;
      left: 12px;
      right: 12px;
      background: rgba(21, 19, 16, 0.90);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--gold-border);
      border-left: 3px solid var(--theme-color);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11.5px;
      color: var(--text-secondary);
      text-align: center;
      pointer-events: none;
      z-index: 15;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
      line-height: 1.4;
    }
    .role-guide-banner b {
      color: var(--gold-soft);
      font-weight: 700;
    }

    /* Camera Permission Card */
    .permission-card {
      position: absolute;
      inset: 12px;
      background: rgba(21, 19, 16, 0.98);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      padding: 20px 16px;
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 12px;
      z-index: 35;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.85);
    }
    .permission-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(186, 29, 29, 0.14);
      border: 1px solid rgba(220, 38, 38, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-soft);
    }
    .permission-card h3 {
      color: var(--text);
      font-family: var(--font-display);
      font-size: 16.5px;
      margin: 0;
      font-weight: 700;
    }
    .permission-card p {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.48;
    }
    .guide-box {
      background: var(--bg-canvas);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      text-align: left;
      font-size: 11.5px;
      color: var(--text-muted);
      width: 100%;
      box-sizing: border-box;
      line-height: 1.45;
    }
    .guide-box b {
      color: var(--text-secondary);
    }
    .guide-box ol {
      margin: 6px 0 0 16px;
      padding: 0;
    }
    .guide-box li {
      margin-bottom: 4px;
    }
    .btn-grant {
      background: linear-gradient(135deg, var(--gold-dark) 0%, var(--gold) 100%);
      color: #120e0b;
      border: 1px solid var(--gold-bright);
      border-radius: 6px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      box-shadow: 0 4px 16px var(--gold-glow);
      transition: all 0.2s ease;
    }
    .btn-grant:active { opacity: 0.88; transform: scale(0.99); }

    /* Tap to start camera overlay (solves mobile autoplay gesture policy) */
    .tap-start-overlay {
      position: absolute;
      inset: 0;
      background: rgba(12, 10, 9, 0.90);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 24px;
      gap: 12px;
      z-index: 32;
      cursor: pointer;
      transition: opacity 0.25s ease;
    }
    .tap-start-overlay.hidden {
      display: none !important;
    }
    .tap-icon-ring {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1f1a14 0%, #14110d 100%);
      border: 1.5px solid var(--gold);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-bright);
      box-shadow: 0 0 26px var(--gold-glow), inset 0 0 12px rgba(194, 159, 85, 0.14);
      animation: pulseTap 2.2s infinite ease-in-out;
    }
    @keyframes pulseTap {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    .tap-title {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      margin: 0;
      letter-spacing: 0.02em;
    }
    .tap-sub {
      font-size: 12.5px;
      color: var(--text-muted);
      max-width: 280px;
      line-height: 1.45;
      margin: 0;
    }
    .tap-btn {
      background: linear-gradient(135deg, var(--gold-dark) 0%, var(--gold) 100%);
      color: #120e0b;
      font-weight: 800;
      font-size: 13.5px;
      letter-spacing: 0.04em;
      padding: 12px 24px;
      border: 1px solid var(--gold-bright);
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 4px 18px var(--gold-glow);
      margin-top: 4px;
    }
    .perm-action-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .btn-subtle {
      background: var(--bg-subtle);
      color: var(--text);
      border: 1px solid var(--wood-border);
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s ease;
    }
    .btn-subtle:active {
      background: var(--bg-hover);
      border-color: var(--gold-border);
    }

    /* Bottom Control Deck (Hinoki Wood & Brass Console) */
    .controls-deck {
      position: relative;
      background: rgba(21, 19, 16, 0.98);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      padding: 11px 14px max(11px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-top: 1px solid var(--border);
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.55);
      z-index: 40;
    }
    .controls-deck::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(194, 159, 85, 0.32) 50%, transparent 100%);
      pointer-events: none;
    }

    .main-action-row {
      display: flex;
      gap: 8px;
    }

    .btn-record-anim {
      flex: 1.5;
      background: linear-gradient(135deg, var(--hanko-bg) 0%, var(--accent-red) 100%);
      color: #ffffff;
      border: 1px solid var(--hanko-border);
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.03em;
      box-shadow: 0 3px 14px var(--crimson-glow);
      transition: all 0.2s ease;
    }
    .btn-record-anim:active {
      transform: scale(0.98);
    }
    .btn-record-anim.recording {
      background: #1a1210;
      border: 1.5px solid var(--hanko-border);
      color: #fca5a5;
      box-shadow: 0 0 18px var(--crimson-glow);
      animation: pulseRedRecord 1.2s infinite;
    }

    @keyframes pulseRedRecord {
      0%, 100% { box-shadow: 0 0 16px rgba(220, 38, 38, 0.65); transform: scale(1); }
      50% { box-shadow: 0 0 6px rgba(220, 38, 38, 0.28); transform: scale(0.99); }
    }

    .rec-live-badge {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(168, 28, 28, 0.94);
      border: 1px solid var(--hanko-border);
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
      padding: 5px 14px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 30;
      box-shadow: 0 4px 16px rgba(186, 29, 29, 0.55);
      letter-spacing: 0.06em;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .rec-live-badge.hidden { display: none !important; }
    .rec-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ffffff;
      animation: blinkDot 0.9s infinite alternate;
    }
    @keyframes blinkDot {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0.25; transform: scale(0.7); }
    }

    .rec-toast {
      position: absolute;
      bottom: 20px;
      left: 14px;
      right: 14px;
      background: rgba(21, 19, 16, 0.97);
      border: 1.5px solid var(--gold);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      z-index: 55;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .rec-toast.hidden { display: none !important; }
    .rec-toast-seal {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 4px;
      background: var(--hanko-bg);
      border: 1px solid var(--gold-border);
      color: #fff;
      font-family: var(--font-kanji);
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .rec-toast-title {
      font-family: var(--font-display);
      font-size: 15.5px;
      font-weight: 700;
      color: var(--gold-bright);
      margin-bottom: 4px;
    }
    .rec-toast-desc {
      font-size: 12.5px;
      color: var(--text-secondary);
      line-height: 1.45;
      margin-bottom: 12px;
    }
    .toast-close-btn {
      background: linear-gradient(135deg, var(--gold-dark) 0%, var(--gold) 100%);
      color: #120e0b;
      font-weight: 700;
      border: 1px solid var(--gold-bright);
      border-radius: 6px;
      padding: 8px 22px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-stream {
      flex: 0.95;
      background: linear-gradient(135deg, var(--gold-dark) 0%, var(--gold) 100%);
      color: #120e0b;
      border: 1px solid var(--gold-bright);
      border-radius: 6px;
      padding: 12px 12px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      letter-spacing: 0.04em;
      box-shadow: 0 3px 14px var(--gold-glow);
      transition: all 0.2s ease;
    }
    .btn-stream:active {
      transform: scale(0.98);
    }
    .btn-stream.streaming {
      background: var(--bg-subtle);
      border: 1px solid var(--wood-border);
      box-shadow: none;
      color: var(--text-secondary);
    }

    .settings-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .select-wrapper {
      position: relative;
    }
    select {
      width: 100%;
      appearance: none;
      -webkit-appearance: none;
      background-color: var(--bg-canvas);
      background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 2L6 6.5L10.5 2' stroke='%23c29f55' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      color: var(--text);
      border: 1px solid var(--wood-border);
      border-radius: 6px;
      padding: 9px 28px 9px 10px;
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: border-color 0.18s ease;
    }
    select:focus {
      border-color: var(--gold);
    }
    .select-arrow {
      display: none;
    }

    .footer-telemetry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: var(--text-muted);
      padding: 0 2px;
    }
    .wakelock-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--gold-soft);
      font-weight: 500;
    }
    .wakelock-indicator.off {
      color: var(--text-muted);
    }
  </style>
</head>
<body data-role="cam1">
  <div id="insecureBanner" class="insecure-alert">
    Камера заблокирована браузером по HTTP.<br>
    <a id="httpsSwitchLink" href="#">Перейти на защищенный HTTPS ➔</a>
  </div>

  <header>
    <div class="brand">
      <div class="brand-seal" aria-hidden="true">
        <span class="brand-hanko">空</span>
      </div>
      <div class="brand-text">
        <span class="brand-title">BUNKAI EXPLORER</span>
        <span class="brand-subtitle">Камера Додзё · MoCap</span>
      </div>
    </div>
    <div class="header-pills">
      <div id="rolePill" class="role-pill">
        <span id="roleIcon" class="role-dot"></span>
        <span id="roleText">Камера 1 (Фронт)</span>
      </div>
      <div id="statusBadge" class="status-badge">
        <div class="status-dot"></div>
        <span id="statusText">Готов</span>
      </div>
    </div>
  </header>

  <div class="viewport" id="viewportArea">
    <video id="videoPreview" autoplay playsinline muted></video>
    <canvas id="captureCanvas"></canvas>

    <!-- Floating Recording Live Badge -->
    <div id="recLiveBadge" class="rec-live-badge hidden">
      <div class="rec-dot"></div>
      <span id="recTimerText">REC 00:00</span>
    </div>

    <!-- Success Toast on Recording Complete -->
    <div id="recToast" class="rec-toast hidden">
      <div class="rec-toast-seal">完</div>
      <div class="rec-toast-title">Анимация успешно сохранена</div>
      <div id="recToastDesc" class="rec-toast-desc">Записано кадров. Перейдите к компьютеру — 3D аватар уже воспроизводит вашу технику!</div>
      <button id="toastCloseBtn" class="toast-close-btn" type="button">Понятно</button>
    </div>

    <!-- Stance Alignment Grid -->
    <div class="grid-overlay" id="gridOverlay">
      <div></div><div></div><div></div>
      <div></div><div></div><div></div>
      <div></div><div></div><div></div>
    </div>
    <div class="crosshair-center"></div>

    <!-- On-Screen Floating HUD -->
    <div class="floating-hud">
      <div class="hud-chips">
        <span class="hud-chip" id="chipRes"><strong>RES</strong> --x--</span>
        <span class="hud-chip" id="chipFps"><strong>FPS</strong> 0.0</span>
        <span class="hud-chip" id="chipCount"><strong>BUF</strong> 0 кадр.</span>
      </div>

      <div class="quick-actions">
        <button id="btnFlipCam" class="circle-btn" type="button" title="Переключить камеру" aria-label="Переключить камеру">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
        </button>
        <button id="btnTorch" class="circle-btn" type="button" title="Фонарик / Подсветка" aria-label="Подсветка" style="display:none;">
          <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </button>
        <button id="btnToggleGrid" class="circle-btn active" type="button" title="Сетка калибровки" aria-label="Сетка калибровки">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
        </button>
        <button id="btnFullscreen" class="circle-btn" type="button" title="Полноэкранный режим" aria-label="Полноэкранный режим">
          <svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
    </div>

    <!-- Dynamic Role Guidance Banner -->
    <div class="role-guide-banner" id="roleGuide">
      <b>КАМЕРА 1 (ФРОНТ):</b> Установите телефон спереди во весь рост (2–3 метра).
    </div>

    <!-- Tap to Start Camera Overlay (Bypasses Mobile Autoplay Blocks) -->
    <div id="tapStartOverlay" class="tap-start-overlay">
      <div class="tap-icon-ring">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
      <div class="tap-title">Активация камеры Додзё</div>
      <div class="tap-sub">Коснитесь экрана, чтобы запустить видеопоток и синхронизацию с 3D-аватаром</div>
      <button id="tapStartBtn" class="tap-btn" type="button">ВКЛЮЧИТЬ КАМЕРУ</button>
    </div>

    <!-- Permission & Camera Error Card -->
    <div id="permissionCard" class="permission-card">
      <div class="permission-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h3 id="permTitle">Доступ к камере смартфона</h3>
      <p id="permDesc">Для передачи видео на компьютер необходимо предоставить доступ к камере.</p>
      <div class="perm-action-group">
        <button id="grantCameraBtn" class="btn-grant" type="button">Разрешить доступ к камере</button>
        <button id="btnTryFrontCam" class="btn-subtle" type="button">Переключить на фронтальную камеру</button>
      </div>
      <div class="guide-box">
        <b>Если камера не включается:</b>
        <ol>
          <li>Убедитесь, что страница открыта по <b><a id="permHttpsLink" href="#" style="color:#e4ce95;">HTTPS</a></b>.</li>
          <li>При предупреждении сертификата нажмите <b>«Дополнительно» → «Перейти на сайт»</b> (Safari: <b>«Показать подробности» → «Посетить этот веб-сайт»</b>).</li>
          <li>В адресной строке выберите <b>«Камера: Разрешить»</b>.</li>
          <li>Закройте другие приложения, которые могут занимать объектив камеры.</li>
        </ol>
      </div>
    </div>
  </div>

  <div class="controls-deck">
    <div class="main-action-row">
      <button id="btnRecordAnim" class="btn-record-anim" type="button">
        <span id="btnRecordIcon">●</span>
        <span id="btnRecordText">ЗАПИСАТЬ АНИМАЦИЮ</span>
      </button>
      <button id="streamBtn" class="btn-stream" type="button">
        <span id="streamBtnIcon">▶</span>
        <span id="streamBtnText">ЭФИР</span>
      </button>
    </div>

    <div class="settings-row">
      <div class="select-wrapper">
        <select id="roleSelect">
          <option value="cam1" selected>Камера 1 (Фронт)</option>
          <option value="cam2">Камера 2 (Сбоку)</option>
          <option value="cam3">Камера 3 (Диагональ)</option>
        </select>
        <div class="select-arrow">▼</div>
      </div>

      <div class="select-wrapper">
        <select id="resSelect">
          <option value="480p" selected>Турбо 480p (Мин. задержка)</option>
          <option value="540p">540p (Баланс)</option>
          <option value="720p">HD 720p (Детализация)</option>
          <option value="1080p">Full HD 1080p</option>
        </select>
        <div class="select-arrow">▼</div>
      </div>
    </div>

    <div class="footer-telemetry">
      <span id="statusHost">Сервер: Подключение...</span>
      <span id="wakeLockStatus" class="wakelock-indicator">
        <span>●</span>
        <span id="wakeLockText">Экран активен</span>
      </span>
    </div>
  </div>

  <script>
    const video = document.getElementById('videoPreview');
    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (ctx) ctx.imageSmoothingEnabled = false;
    const roleSelect = document.getElementById('roleSelect');
    const resSelect = document.getElementById('resSelect');
    const streamBtn = document.getElementById('streamBtn');
    const streamBtnIcon = document.getElementById('streamBtnIcon');
    const streamBtnText = document.getElementById('streamBtnText');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const rolePill = document.getElementById('rolePill');
    const roleIcon = document.getElementById('roleIcon');
    const roleText = document.getElementById('roleText');
    const roleGuide = document.getElementById('roleGuide');
    const chipFps = document.getElementById('chipFps');
    const chipRes = document.getElementById('chipRes');
    const chipCount = document.getElementById('chipCount');
    const statusHost = document.getElementById('statusHost');
    const wakeLockStatus = document.getElementById('wakeLockStatus');
    const wakeLockText = document.getElementById('wakeLockText');
    const permissionCard = document.getElementById('permissionCard');
    const grantCameraBtn = document.getElementById('grantCameraBtn');
    const btnTryFrontCam = document.getElementById('btnTryFrontCam');
    const tapStartOverlay = document.getElementById('tapStartOverlay');
    const tapStartBtn = document.getElementById('tapStartBtn');
    const insecureBanner = document.getElementById('insecureBanner');
    const httpsSwitchLink = document.getElementById('httpsSwitchLink');
    const permHttpsLink = document.getElementById('permHttpsLink');
    const btnFlipCam = document.getElementById('btnFlipCam');
    const btnTorch = document.getElementById('btnTorch');
    const btnToggleGrid = document.getElementById('btnToggleGrid');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const gridOverlay = document.getElementById('gridOverlay');

    const btnRecordAnim = document.getElementById('btnRecordAnim');
    const btnRecordIcon = document.getElementById('btnRecordIcon');
    const btnRecordText = document.getElementById('btnRecordText');
    const recLiveBadge = document.getElementById('recLiveBadge');
    const recTimerText = document.getElementById('recTimerText');
    const recToast = document.getElementById('recToast');
    const recToastDesc = document.getElementById('recToastDesc');
    const toastCloseBtn = document.getElementById('toastCloseBtn');

    let isRecordingAnim = false;
    let recStartTime = 0;
    let recTimerInterval = null;

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function setRecordingUI(active, savedFrames) {
      isRecordingAnim = active;
      if (active) {
        btnRecordAnim.classList.add('recording');
        btnRecordIcon.textContent = '■';
        btnRecordText.textContent = 'СТОП (REC)';
        recLiveBadge.classList.remove('hidden');
        if (!recTimerInterval) {
          recStartTime = performance.now();
          recTimerInterval = setInterval(() => {
            const elapsed = (performance.now() - recStartTime) / 1000;
            const timeStr = formatTime(elapsed);
            recTimerText.textContent = `REC ${timeStr}`;
            btnRecordText.textContent = `СТОП (${timeStr})`;
          }, 250);
        }
      } else {
        btnRecordAnim.classList.remove('recording');
        btnRecordIcon.textContent = '●';
        btnRecordText.textContent = 'ЗАПИСАТЬ АНИМАЦИЮ';
        recLiveBadge.classList.add('hidden');
        if (recTimerInterval) {
          clearInterval(recTimerInterval);
          recTimerInterval = null;
        }
        if (savedFrames && savedFrames > 0) {
          recToastDesc.textContent = `Записано ${savedFrames} кадров движения. Перейдите к компьютеру — 3D аватар уже воспроизводит вашу технику!`;
          recToast.classList.remove('hidden');
          setTimeout(() => { recToast.classList.add('hidden'); }, 7000);
        }
      }
    }

    toastCloseBtn.addEventListener('click', () => {
      recToast.classList.add('hidden');
    });

    async function toggleRecordingFromPhone() {
      if (!isStreaming) {
        await startCameraAndStream();
        await new Promise(r => setTimeout(r, 600));
      }

      if (!isRecordingAnim) {
        setRecordingUI(true);
        try {
          const resp = await fetch('/api/record/start', { method: 'POST' });
          if (!resp.ok) setRecordingUI(false);
        } catch (e) {
          console.error('Error starting record:', e);
        }
      } else {
        try {
          const resp = await fetch('/api/record/stop', { method: 'POST' });
          const data = await resp.json();
          setRecordingUI(false, data.frames || 0);
        } catch (e) {
          console.error('Error stopping record:', e);
          setRecordingUI(false);
        }
      }
    }

    btnRecordAnim.addEventListener('click', toggleRecordingFromPhone);



    let currentStream = null;
    let ws = null;
    let isStreaming = false;
    let facingMode = 'environment'; // back camera by default for wider angle on tripod
    let isTorchOn = false;
    let frameCount = 0;
    let totalFramesSent = 0;
    let fpsTimer = performance.now();
    let wakeLock = null;

    // Detect role from URL path or query params (e.g. /cam1, /cam2, /cam3 or ?cam=cam3)
    function autoDetectRoleFromUrl() {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const qCam = (params.get('cam') || params.get('camera') || params.get('role') || '').toLowerCase();
      if (qCam === 'cam3' || path.includes('cam3')) {
        roleSelect.value = 'cam3';
      } else if (qCam === 'cam2' || path.includes('cam2')) {
        roleSelect.value = 'cam2';
      } else {
        roleSelect.value = 'cam1';
      }
      applyRoleTheme(roleSelect.value);
    }

    function applyRoleTheme(role) {
      document.body.setAttribute('data-role', role);
      if (role === 'cam1') {
        roleText.textContent = 'Камера 1 (Фронт)';
        roleGuide.innerHTML = '<b>КАМЕРА 1 (ФРОНТ):</b> Установите телефон спереди во весь рост (2–3 метра).';
      } else if (role === 'cam2') {
        roleText.textContent = 'Камера 2 (Сбоку)';
        roleGuide.innerHTML = '<b>КАМЕРА 2 (СБОКУ):</b> Установите сбоку под углом 90° для точной глубины стоек.';
      } else {
        roleText.textContent = 'Камера 3 (Угол)';
        roleGuide.innerHTML = '<b>КАМЕРА 3 (УГОЛ):</b> Диагональный ракурс 45° для детального захвата ударов.';
      }
    }

    roleSelect.addEventListener('change', () => {
      applyRoleTheme(roleSelect.value);
      if (isStreaming) {
        // Reconnect WebSocket to the new role endpoint immediately
        connectWebSocket();
      }
    });

    // Check secure context (HTTPS / localhost required for getUserMedia on phones)
    const targetHttpsPort = (window.location.port === '8000') ? '8088' : ((window.location.port === '80' || !window.location.port) ? '8443' : (window.location.port === '5173' ? '8443' : (window.location.port || '8088')));
    const httpsPortPart = (targetHttpsPort && targetHttpsPort !== '443') ? `:${targetHttpsPort}` : '';
    const httpsUrl = `https://${window.location.hostname}${httpsPortPart}${window.location.pathname}${window.location.search}`;
    httpsSwitchLink.href = httpsUrl;
    permHttpsLink.href = httpsUrl;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      insecureBanner.style.display = 'block';
    }

    statusHost.textContent = `Хост: ${window.location.hostname}:${window.location.port}`;

    // Keep screen awake while app is running
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLockStatus.classList.remove('off');
          wakeLockText.textContent = 'Экран не погаснет';
          wakeLock.addEventListener('release', () => {
            wakeLockStatus.classList.add('off');
            wakeLockText.textContent = 'Экран: обычный';
          });
        }
      } catch (e) {
        wakeLockStatus.classList.add('off');
        wakeLockText.textContent = 'WakeLock недоступен';
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });

    async function getCameraStream(facing, width, height) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }

      // Tier 1: requested resolution and ideal facing mode
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: 30 }
          }
        });
      } catch (e1) {
        console.warn('Tier 1 constraints failed:', e1);
      }

      // Tier 2: exact facing mode with ideal resolution
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: facing,
            width: { ideal: width },
            height: { ideal: height }
          }
        });
      } catch (e2) {
        console.warn('Tier 2 constraints failed:', e2);
      }

      // Tier 3: facing mode ideal without resolution restriction
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing } }
        });
      } catch (e3) {
        console.warn('Tier 3 constraints failed:', e3);
      }

      // Tier 4: facing mode exact string without resolution restriction
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: facing }
        });
      } catch (e4) {
        console.warn('Tier 4 constraints failed:', e4);
      }

      // Tier 5: absolute fallback to any video camera on device
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
    }

    async function initCamera() {
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!hasMediaDevices) {
        showPermissionError('SECURE_CONTEXT_REQUIRED', 'Браузер заблокировал доступ к камере по HTTP. Перейдите на защищенный HTTPS.');
        return false;
      }

      if (currentStream) {
        try {
          currentStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        currentStream = null;
      }

      const resChoice = resSelect.value;
      let width = 960, height = 540;
      if (resChoice === '1080p') { width = 1920; height = 1080; }
      else if (resChoice === '720p') { width = 1280; height = 720; }
      else if (resChoice === '480p') { width = 640; height = 480; }

      try {
        currentStream = await getCameraStream(facingMode, width, height);

        // Required on mobile Safari & Chrome to allow video playback without user gesture denial
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('muted', '');

        video.srcObject = currentStream;

        // Ensure video metadata loaded before playing
        await new Promise((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.onloadedmetadata = () => resolve();
            setTimeout(resolve, 800);
          }
        });

        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() rejected (autoplay policy), showing tap overlay:', playErr);
          tapStartOverlay.classList.remove('hidden');
          return false;
        }

        tapStartOverlay.classList.add('hidden');
        hidePermissionError();

        // Apply visual mirroring only if front selfie camera is active
        video.classList.toggle('mirrored', facingMode === 'user');

        const track = currentStream.getVideoTracks()[0];
        const vw = video.videoWidth || width;
        const vh = video.videoHeight || height;

        // Strict ultra-low latency canvas sizing:
        // Cap maximum dimension to 640px (or 480px for 480p mode), preserving aspect ratio
        const roleVal = roleSelect.value;
        const isSideCam = (roleVal === 'cam2' || roleVal === 'cam3');
        let maxDim = (resChoice === '720p') ? 800 : ((resChoice === '1080p') ? 1080 : 480);
        if (resChoice === '480p') maxDim = isSideCam ? 400 : 480;

        let cWidth = vw;
        let cHeight = vh;
        if (cWidth > maxDim || cHeight > maxDim) {
          if (cWidth >= cHeight) {
            cHeight = Math.round((cHeight / cWidth) * maxDim);
            cWidth = maxDim;
          } else {
            cWidth = Math.round((cWidth / cHeight) * maxDim);
            cHeight = maxDim;
          }
        }
        canvas.width = cWidth;
        canvas.height = cHeight;
        chipRes.innerHTML = `<strong>RES</strong> ${canvas.width}x${canvas.height}`;

        // Check torch capabilities
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          btnTorch.style.display = 'flex';
        } else {
          btnTorch.style.display = 'none';
        }

        requestWakeLock();
        return true;
      } catch (err) {
        console.error('Camera init error:', err);
        tapStartOverlay.classList.remove('hidden');
        showPermissionError(err.name || 'CameraError', err.message);
        return false;
      }
    }

    function showPermissionError(errName, errMsg) {
      permissionCard.style.display = 'flex';
      const title = document.getElementById('permTitle');
      const desc = document.getElementById('permDesc');

      if (errName === 'SECURE_CONTEXT_REQUIRED' || window.location.protocol !== 'https:') {
        title.textContent = 'Требуется защищенный HTTPS';
        desc.innerHTML = `Мобильные браузеры (Safari / Chrome) блокируют доступ к камере по HTTP.<br><br><a href="${httpsUrl}" style="display:inline-block; background:linear-gradient(135deg, #8a6c2f, #c29f55); color:#120e0b; padding:10px 16px; border-radius:6px; font-weight:700; text-decoration:none; border:1px solid #e4ce95;">Перейти на HTTPS ➔</a>`;
      } else if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        title.textContent = 'Доступ к камере ожидает подтверждения';
        desc.textContent = 'Браузер ожидает разрешения на использование камеры. Нажмите кнопку ниже или проверьте значок замка в адресной строке.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        title.textContent = 'Камера не обнаружена';
        desc.textContent = 'Запрашиваемый модуль камеры не найден на устройстве. Попробуйте переключиться на фронтальную камеру.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        title.textContent = 'Камера занята другим приложением';
        desc.textContent = 'Камера используется другим приложением. Закройте их и повторите попытку.';
      } else {
        title.textContent = 'Ошибка доступа к камере';
        desc.textContent = errMsg || 'Не удалось активировать видеопоток с камеры смартфона.';
      }
    }

    function hidePermissionError() {
      permissionCard.style.display = 'none';
    }

    async function startCameraAndStream() {
      hidePermissionError();
      const ok = await initCamera();
      if (ok || (currentStream && currentStream.active)) {
        connectWebSocket();
      }
    }

    grantCameraBtn.addEventListener('click', startCameraAndStream);

    btnTryFrontCam.addEventListener('click', async () => {
      facingMode = 'user';
      startCameraAndStream();
    });

    tapStartOverlay.addEventListener('click', startCameraAndStream);

    tapStartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startCameraAndStream();
    });

    btnFlipCam.addEventListener('click', async () => {
      facingMode = (facingMode === 'environment') ? 'user' : 'environment';
      const ok = await initCamera();
      if (ok && isStreaming) {
        startFramePump();
      }
    });

    btnTorch.addEventListener('click', async () => {
      if (!currentStream) return;
      const track = currentStream.getVideoTracks()[0];
      if (track && track.applyConstraints) {
        try {
          isTorchOn = !isTorchOn;
          await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
          btnTorch.classList.toggle('active', isTorchOn);
        } catch (e) {
          console.warn('Torch toggle failed:', e);
        }
      }
    });

    btnToggleGrid.addEventListener('click', () => {
      const isHidden = gridOverlay.classList.toggle('hidden');
      btnToggleGrid.classList.toggle('active', !isHidden);
    });

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    resSelect.addEventListener('change', async () => {
      await initCamera();
    });

    let userStoppedStreaming = false;
    let reconnectTimeout = null;
    let isEncoding = false;
    let inFlightCount = 0;
    let lastSendTime = 0;
    let frameSendTime = 0;
    let isPumpActive = false;

    function connectWebSocket() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (ws) {
        try { ws.close(); } catch (e) {}
      }

      userStoppedStreaming = false;
      const role = roleSelect.value;
      const host = window.location.host;
      const protocol = (window.location.protocol === 'https:') ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + host + '/ws/stream/' + role;

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        statusBadge.classList.add('live');
        statusText.textContent = 'В ЭФИРЕ';
        streamBtn.classList.add('streaming');
        streamBtnIcon.textContent = '■';
        streamBtnText.textContent = 'ОСТАНОВИТЬ';
        document.body.classList.add('is-live');
        isStreaming = true;
        isEncoding = false;
        inFlightCount = 0;
        lastSendTime = 0;
        requestWakeLock();
        startFramePump();
      };

      ws.onclose = () => {
        statusBadge.classList.remove('live');
        document.body.classList.remove('is-live');
        isStreaming = false;
        isEncoding = false;
        inFlightCount = 0;
        isPumpActive = false;

        if (userStoppedStreaming) {
          statusText.textContent = 'Готов';
          streamBtn.classList.remove('streaming');
          streamBtnIcon.textContent = '▶';
          streamBtnText.textContent = 'ЭФИР';
        } else {
          // Unexpected drop / Wi-Fi jitter: Auto-reconnect seamlessly!
          statusText.textContent = 'Связь...';
          streamBtnIcon.textContent = '↻';
          streamBtnText.textContent = 'ПОДКЛЮЧЕНИЕ...';
          reconnectTimeout = setTimeout(() => {
            if (!userStoppedStreaming) {
              connectWebSocket();
            }
          }, 1500);
        }
      };

      ws.onmessage = (event) => {
        // Fast binary ACK (0x06) from server
        inFlightCount = Math.max(0, inFlightCount - 1);
        if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          const rtt = Math.round(performance.now() - frameSendTime);
          chipCount.innerHTML = '<strong>RTT</strong> ' + rtt + ' ms · ' + totalFramesSent + ' к.';
          return;
        }
        try {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            if (msg.type === 'ack') {
              const rtt = Math.round(performance.now() - frameSendTime);
              chipCount.innerHTML = '<strong>RTT</strong> ' + rtt + ' ms · ' + totalFramesSent + ' к.';
              return;
            }
            if (msg.type === 'record_status') {
              if (msg.is_recording !== isRecordingAnim) {
                setRecordingUI(msg.is_recording, msg.saved_frames || 0);
              }
            }
          }
        } catch (e) {}
      };

      ws.onerror = (e) => {
        console.error('WS Error:', e);
      };
    }

    // High-Throughput Continuous Frame Pump:
    // Decoupled from network RTT. Always runs with hardware compositor ticks.
    // Non-blocking backpressure gracefully drops frames if socket buffer backs up.
    function startFramePump() {
      if (isPumpActive) return;
      isPumpActive = true;

      function onTick() {
        if (!isStreaming || !isPumpActive) {
          isPumpActive = false;
          return;
        }

        // Always register next hardware frame immediately so camera compositor never starves
        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(onTick);
        } else {
          requestAnimationFrame(onTick);
        }

        processAndSend();
      }

      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(onTick);
      } else {
        requestAnimationFrame(onTick);
      }
    }

    function processAndSend() {
      if (!isStreaming || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (isEncoding) return; // Previous JPEG compression still running

      // Socket buffer backpressure: if outgoing buffer has > 64KB unsent data,
      // skip this frame to prevent buffer bloat and latency accumulation
      if (ws.bufferedAmount > 65536) return;

      // Pipelining: allow up to 2 frames in-flight across Wi-Fi without starving the camera
      if (inFlightCount >= 2) return;

      const now = performance.now();
      // Cap at ~30-33 FPS (min 28ms interval) to prevent mobile thermal throttling
      if (now - lastSendTime < 28) return;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        isEncoding = true;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const resChoice = resSelect.value;
          const isSideCam = (roleSelect.value === 'cam2' || roleSelect.value === 'cam3');
          let quality = isSideCam ? 0.32 : 0.40;
          if (resChoice === '1080p') quality = 0.55;
          else if (resChoice === '720p') quality = 0.48;
          else if (resChoice === '540p') quality = isSideCam ? 0.35 : 0.42;

          canvas.toBlob((blob) => {
            isEncoding = false;
            try {
              if (blob && isStreaming && ws && ws.readyState === WebSocket.OPEN) {
                if (ws.bufferedAmount <= 65536 && inFlightCount < 2) {
                  inFlightCount++;
                  lastSendTime = performance.now();
                  frameSendTime = lastSendTime;
                  ws.send(blob);
                  frameCount++;
                  totalFramesSent++;

                  const t_fps = performance.now();
                  if (t_fps - fpsTimer >= 1000) {
                    const fps = (frameCount * 1000) / (t_fps - fpsTimer);
                    chipFps.innerHTML = '<strong>FPS</strong> ' + fps.toFixed(1);
                    frameCount = 0;
                    fpsTimer = t_fps;
                  }
                }
              }
            } catch (err) {
              inFlightCount = Math.max(0, inFlightCount - 1);
              console.warn('Frame send error:', err);
            }
          }, 'image/jpeg', quality);
        } catch (e) {
          isEncoding = false;
        }
      }
    }

    // Network watchdog: resets in-flight counter if packets were dropped over Wi-Fi
    setInterval(() => {
      if (isStreaming && ws && ws.readyState === WebSocket.OPEN) {
        const now = performance.now();
        if (inFlightCount > 0 && (now - frameSendTime > 150)) {
          inFlightCount = 0;
        }
        if (!isPumpActive) {
          startFramePump();
        }
      }
    }, 100);

    streamBtn.addEventListener('click', async () => {
      if (!isStreaming) {
        userStoppedStreaming = false;
        await startCameraAndStream();
      } else {
        userStoppedStreaming = true;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws) ws.close();
      }
    });

    // Auto-detect role from URL and initialize camera with auto-stream if permission granted
    autoDetectRoleFromUrl();
    (async () => {
      const ok = await initCamera();
      if (ok) {
        connectWebSocket();
      }
    })();
  </script>
</body>
</html>
"""


class PhoneStreamServer:
    """
    Lightweight FastAPI + Uvicorn server running in a daemon thread.
    Receives live camera frames from mobile devices over Wi-Fi.
    Supports SSL (HTTPS / WSS) for mobile browser security.
    """

    def __init__(self, port: int = 8088, use_ssl: bool = True):
        self.port = port
        self.use_ssl = use_ssl
        self.local_ip = get_local_ip()

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            self.loop = asyncio.get_running_loop()
            yield

        self.app = FastAPI(title="Karate Motion Studio Mobile Cam Receiver", lifespan=lifespan)
        self._setup_routes()

        # Thread-safe storage: camera_id -> (bgr_frame, timestamp, fps)
        self.lock = threading.Lock()
        self.latest_frames: Dict[str, np.ndarray] = {}
        self.frame_timestamps: Dict[str, float] = {}
        self.frame_fps: Dict[str, float] = {}
        self.frame_counts: Dict[str, int] = {}
        self.fps_timers: Dict[str, float] = {}
        self.frame_seq: Dict[str, int] = {}
        self.new_frame_event = threading.Event()

        # Remote Recording Synchronization
        self.is_recording: bool = False
        self.record_start_t: float = 0.0
        self.last_recorded_frames: int = 0
        self.record_command_handler: Optional[Callable[[str], None]] = None
        self.active_websockets: Set[WebSocket] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # Callbacks registered by Qt UI
        self.frame_callbacks: List[Callable[[str, np.ndarray, float], None]] = []

        self.server_thread: Optional[threading.Thread] = None
        self.server: Optional[uvicorn.Server] = None
        self.is_running = False

    def _setup_routes(self):
        @self.app.get("/", response_class=HTMLResponse)
        async def get_mobile_ui():
            return HTMLResponse(content=MOBILE_CLIENT_HTML, status_code=200)

        @self.app.get("/cam1", response_class=HTMLResponse)
        async def get_mobile_cam1():
            return HTMLResponse(content=MOBILE_CLIENT_HTML, status_code=200)

        @self.app.get("/cam2", response_class=HTMLResponse)
        async def get_mobile_cam2():
            return HTMLResponse(content=MOBILE_CLIENT_HTML, status_code=200)

        @self.app.get("/cam3", response_class=HTMLResponse)
        async def get_mobile_cam3():
            return HTMLResponse(content=MOBILE_CLIENT_HTML, status_code=200)

        @self.app.get("/qr.png")
        async def get_qr_png():
            url = self.get_connection_url("cam1")
            img_bytes = self.generate_qr_png_bytes(url)
            return Response(content=img_bytes, media_type="image/png")

        @self.app.get("/qr/cam1.png")
        async def get_qr_cam1_png():
            url = self.get_connection_url("cam1")
            img_bytes = self.generate_qr_png_bytes(url)
            return Response(content=img_bytes, media_type="image/png")

        @self.app.get("/qr/cam2.png")
        async def get_qr_cam2_png():
            url = self.get_connection_url("cam2")
            img_bytes = self.generate_qr_png_bytes(url)
            return Response(content=img_bytes, media_type="image/png")

        @self.app.get("/qr/cam3.png")
        async def get_qr_cam3_png():
            url = self.get_connection_url("cam3")
            img_bytes = self.generate_qr_png_bytes(url)
            return Response(content=img_bytes, media_type="image/png")

        @self.app.get("/status")
        async def get_status():
            with self.lock:
                cams = list(self.latest_frames.keys())
            dur = time.time() - self.record_start_t if self.is_recording else 0.0
            return {
                "server": "Karate Motion Studio Phone Receiver",
                "ip": self.local_ip,
                "port": self.port,
                "ssl": self.use_ssl,
                "url": self.get_connection_url(),
                "active_cameras": cams,
                "is_recording": self.is_recording,
                "recording_duration": round(dur, 2),
                "last_frames": self.last_recorded_frames,
            }

        @self.app.post("/api/record/start")
        async def api_record_start():
            self.is_recording = True
            self.record_start_t = time.time()
            self.dispatch_record_command("start")
            await self.broadcast_json({"type": "record_status", "is_recording": True})
            return {"status": "ok", "action": "start"}

        @self.app.post("/api/record/stop")
        async def api_record_stop():
            self.is_recording = False
            self.dispatch_record_command("stop")
            await asyncio.sleep(0.08)
            await self.broadcast_json({"type": "record_status", "is_recording": False, "saved_frames": self.last_recorded_frames})
            return {"status": "ok", "action": "stop", "frames": self.last_recorded_frames}

        @self.app.get("/api/record/status")
        async def api_record_status():
            dur = time.time() - self.record_start_t if self.is_recording else 0.0
            return {
                "is_recording": self.is_recording,
                "duration": round(dur, 2),
                "frames": self.last_recorded_frames,
            }

        @self.app.websocket("/ws/stream/{camera_id}")
        async def stream_endpoint(websocket: WebSocket, camera_id: str):
            await websocket.accept()
            self.active_websockets.add(websocket)
            t_last_fps = time.time()
            c_frames = 0
            cur_fps = 0.0

            try:
                while True:
                    msg = await websocket.receive()
                    if "bytes" in msg and msg["bytes"]:
                        data = msg["bytes"]
                        nparr = np.frombuffer(data, np.uint8)
                        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                        if frame_bgr is not None:
                            t_now = time.time()
                            c_frames += 1
                            if t_now - t_last_fps >= 1.0:
                                cur_fps = c_frames / (t_now - t_last_fps)
                                c_frames = 0
                                t_last_fps = t_now

                            with self.lock:
                                self.latest_frames[camera_id] = frame_bgr
                                self.frame_timestamps[camera_id] = t_now
                                self.frame_fps[camera_id] = cur_fps
                                self.frame_seq[camera_id] = self.frame_seq.get(camera_id, 0) + 1
                            self.new_frame_event.set()

                            # Dispatch callback
                            for cb in self.frame_callbacks:
                                try:
                                    cb(camera_id, frame_bgr, cur_fps)
                                except Exception:
                                    pass
                    elif "text" in msg and msg["text"]:
                        try:
                            cmd = json.loads(msg["text"])
                            action = cmd.get("action")
                            if action == "start_recording":
                                self.is_recording = True
                                self.record_start_t = time.time()
                                self.dispatch_record_command("start")
                                await self.broadcast_json({"type": "record_status", "is_recording": True})
                            elif action == "stop_recording":
                                self.is_recording = False
                                self.dispatch_record_command("stop")
                                await asyncio.sleep(0.08)
                                await self.broadcast_json({"type": "record_status", "is_recording": False, "saved_frames": self.last_recorded_frames})
                        except Exception:
                            pass
            except WebSocketDisconnect:
                pass
            finally:
                self.active_websockets.discard(websocket)
                with self.lock:
                    if camera_id in self.latest_frames:
                        del self.latest_frames[camera_id]

    async def broadcast_json(self, data: dict):
        text = json.dumps(data)
        to_remove = set()
        for ws in list(self.active_websockets):
            try:
                await ws.send_text(text)
            except Exception:
                to_remove.add(ws)
        self.active_websockets -= to_remove

    def set_record_command_handler(self, handler: Callable[[str], None]):
        """Sets callback invoked when mobile user requests start/stop recording."""
        self.record_command_handler = handler

    def dispatch_record_command(self, action: str):
        if self.record_command_handler:
            try:
                self.record_command_handler(action)
            except Exception:
                pass

    def notify_recording_finished(self, frame_count: int):
        """Called by Qt main window when recording completes and animation is baked."""
        self.is_recording = False
        self.last_recorded_frames = frame_count
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_json({"type": "record_status", "is_recording": False, "saved_frames": frame_count}),
                self.loop
            )

    def notify_recording_started(self):
        """Called by Qt main window when recording starts from PC UI."""
        self.is_recording = True
        self.record_start_t = time.time()
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_json({"type": "record_status", "is_recording": True}),
                self.loop
            )

    def register_frame_callback(self, cb: Callable[[str, np.ndarray, float], None]):
        """Registers a listener for newly received phone camera frames."""
        if cb not in self.frame_callbacks:
            self.frame_callbacks.append(cb)

    def unregister_frame_callback(self, cb: Callable[[str, np.ndarray, float], None]):
        if cb in self.frame_callbacks:
            self.frame_callbacks.remove(cb)

    def get_latest_frame(self, camera_id: str) -> Optional[Tuple[np.ndarray, float]]:
        """Returns the latest (bgr_frame, fps) for camera_id if available within last 2 seconds."""
        with self.lock:
            if camera_id in self.latest_frames:
                t = self.frame_timestamps.get(camera_id, 0.0)
                if time.time() - t < 2.0:
                    return self.latest_frames[camera_id], self.frame_fps.get(camera_id, 0.0)
        return None

    def get_frame_seq(self, camera_id: str) -> int:
        """Returns the monotonic frame sequence ID for camera_id."""
        with self.lock:
            return self.frame_seq.get(camera_id, 0)

    def get_latest_frame_if_new(self, camera_id: str, last_seq: int = -1) -> Optional[Tuple[np.ndarray, float, int]]:
        """
        Returns (bgr_frame, fps, current_seq) only if a newer frame than last_seq has arrived.
        If no newer frame is available, returns None immediately without duplicating memory.
        """
        with self.lock:
            seq = self.frame_seq.get(camera_id, 0)
            if last_seq >= 0 and seq <= last_seq:
                return None
            if camera_id in self.latest_frames:
                t = self.frame_timestamps.get(camera_id, 0.0)
                if time.time() - t < 2.0:
                    return self.latest_frames[camera_id], self.frame_fps.get(camera_id, 0.0), seq
        return None

    def wait_for_frame(self, timeout: float = 0.033) -> bool:
        """Blocks until a new camera frame is received or timeout expires."""
        signaled = self.new_frame_event.wait(timeout)
        self.new_frame_event.clear()
        return signaled

    def get_connected_cameras(self) -> List[str]:
        """Returns list of active camera IDs (e.g. ['cam1', 'cam2'])."""
        with self.lock:
            now = time.time()
            return [cid for cid, t in self.frame_timestamps.items() if now - t < 2.0]

    def get_connection_url(self, role: Optional[str] = None) -> str:
        protocol = "https" if self.use_ssl else "http"
        base = f"{protocol}://{self.local_ip}:{self.port}"
        if role:
            return f"{base}/{role}"
        return base

    def generate_qr_png_bytes(self, url: Optional[str] = None, role: Optional[str] = None) -> bytes:
        """Generates a PNG QR code for the given URL or role."""
        target_url = url or self.get_connection_url(role)
        if HAS_QRCODE:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=8,
                border=2,
            )
            qr.add_data(target_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
        else:
            # Fallback simple 1x1 dummy PNG if qrcode unavailable
            img = np.full((120, 120, 3), 255, dtype=np.uint8)
            cv2.putText(img, "QR", (30, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
            _, png = cv2.imencode(".png", img)
            return png.tobytes()

    def start(self):
        """Starts the FastAPI streaming server in a background daemon thread."""
        if self.is_running:
            return

        self.local_ip = get_local_ip()

        config_kwargs: Dict[str, Any] = {
            "app": self.app,
            "host": "0.0.0.0",
            "port": self.port,
            "log_level": "warning",
            "access_log": False,
        }

        if self.use_ssl:
            demo_dir = Path(__file__).resolve().parent.parent / "demo_assets"
            cert_path = demo_dir / "ssl_cert.pem"
            key_path = demo_dir / "ssl_key.pem"
            needs_new_cert = not cert_path.is_file() or not key_path.is_file()

            if not needs_new_cert:
                try:
                    from cryptography import x509
                    cert_bytes = cert_path.read_bytes()
                    cert_obj = x509.load_pem_x509_certificate(cert_bytes)
                    san_ext = cert_obj.extensions.get_extension_for_oid(x509.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
                    san_ips = [str(ip) for ip in san_ext.value.get_values_for_type(x509.IPAddress)]
                    san_dns = [str(d) for d in san_ext.value.get_values_for_type(x509.DNSName)]
                    if self.local_ip not in san_ips and self.local_ip not in san_dns:
                        needs_new_cert = True
                except Exception:
                    needs_new_cert = True

            if needs_new_cert:
                generate_self_signed_cert(cert_path, key_path, self.local_ip)

            if cert_path.is_file() and key_path.is_file():
                config_kwargs["ssl_keyfile"] = str(key_path)
                config_kwargs["ssl_certfile"] = str(cert_path)

        config = uvicorn.Config(**config_kwargs)
        self.server = uvicorn.Server(config)

        def _run():
            self.server.run()

        self.server_thread = threading.Thread(target=_run, daemon=True, name="PhoneStreamServerThread")
        self.server_thread.start()
        self.is_running = True

    def stop(self):
        """Stops the streaming server."""
        self.is_running = False
        if self.server:
            self.server.should_exit = True
