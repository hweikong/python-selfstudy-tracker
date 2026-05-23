"""Minimal HTTP server for persistent progress storage.

Serves the tracker pages AND provides a JSON API endpoint
to save/load progress data to/from a file on disk.

Usage:
    python server.py          # starts on port 8765 (default)
    python server.py 9000    # custom port

Then open in browser: http://localhost:8765/index.html
"""
import http.server
import json
import os
import sys
import socketserver

# ---------- config ----------
DATA_DIR = os.path.expanduser(os.path.join('~', '.hermes', 'python-selfstudy-progress'))
DATA_FILE = os.path.join(DATA_DIR, 'progress.json')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.makedirs(DATA_DIR, exist_ok=True)

# ---------- file storage ----------
def read_progress():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def write_progress(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------- HTTP handler ----------
class TrackerHandler(http.server.SimpleHTTPRequestHandler):
    # Serve from the tracker directory
    def __init__(self, *args, **kwargs):
        kwargs['directory'] = os.path.dirname(__file__) or '.'
        super().__init__(*args, **kwargs)

    def log_message(self, format, *args):
        # Quiet log
        pass

    def _cors(self):
        """Send CORS headers."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/progress' or self.path == '/api/progress.json':
            data = read_progress()
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith('/api/save'):
            # Read body from request
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw = self.rfile.read(content_length)
                data = json.loads(raw)
            else:
                data = {}
            write_progress(data)
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/progress':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw = self.rfile.read(content_length)
                data = json.loads(raw)
            else:
                data = {}
            write_progress(data)
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_error(404)

# ---------- start ----------
if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), TrackerHandler) as httpd:
        print(f'Progress tracker API running on http://localhost:{PORT}')
        print(f'Data stored in: {DATA_FILE}')
        httpd.serve_forever()
