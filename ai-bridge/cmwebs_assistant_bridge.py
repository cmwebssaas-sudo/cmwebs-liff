"""CMWebs landlord assistant bridge on AI-00.

Runs as its own small service, separate from AI Company OS. It listens on
loopback only; the read Worker reaches it through a Cloudflare Workers VPC
service on the existing AI-00 tunnel. It asks the AI-01 model to pick one
function from the catalog the Worker sends and to write a one-line reply.
It never sees landlord data and never stores questions.

Configuration (environment):
  CMWEBS_ASSISTANT_TOKEN_FILE  file holding the shared bearer token (mode 600)
  CMWEBS_ASSISTANT_PORT        loopback port, default 18760
  CMWEBS_ASSISTANT_MODEL_URL   Ollama base URL on AI-01 (host-local env file only)
  CMWEBS_ASSISTANT_MODEL       model name, default qwen3.5-maus:9b
  CMWEBS_ASSISTANT_TIMEOUT     model timeout in seconds, default 20
"""

from __future__ import annotations

import hmac
import json
import os
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 32 * 1024
MAX_QUESTION = 200
MAX_CATALOG = 80
MAX_REPLY = 200
QUEUE_WAIT_SECONDS = 10

_model_lock = threading.Lock()


def load_config(env=os.environ):
    token_file = env.get('CMWEBS_ASSISTANT_TOKEN_FILE', '')
    token = ''
    if token_file:
        with open(token_file, encoding='utf-8') as handle:
            token = handle.read().strip()
    return {
        'token': token,
        'port': int(env.get('CMWEBS_ASSISTANT_PORT', '18760')),
        'model_url': env.get('CMWEBS_ASSISTANT_MODEL_URL', '').rstrip('/'),
        'model': env.get('CMWEBS_ASSISTANT_MODEL', 'qwen3.5-maus:9b'),
        'timeout': float(env.get('CMWEBS_ASSISTANT_TIMEOUT', '20')),
    }


class BridgeError(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


def _text(value, limit):
    return str(value if value is not None else '').strip()[:limit]


def parse_request(raw):
    try:
        payload = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise BridgeError(400, 'INVALID_JSON')
    if not isinstance(payload, dict):
        raise BridgeError(400, 'INVALID_JSON')
    question = _text(payload.get('question'), MAX_QUESTION + 1)
    if not question or len(question) > MAX_QUESTION:
        raise BridgeError(400, 'INVALID_QUESTION')
    catalog = payload.get('catalog')
    if not isinstance(catalog, list) or not catalog or len(catalog) > MAX_CATALOG:
        raise BridgeError(400, 'INVALID_CATALOG')
    items = []
    for item in catalog:
        if not isinstance(item, dict):
            raise BridgeError(400, 'INVALID_CATALOG')
        item_id = _text(item.get('id'), 40)
        title = _text(item.get('title'), 60)
        keywords = item.get('keywords') if isinstance(item.get('keywords'), list) else []
        if not item_id or not title or item_id == 'none':
            raise BridgeError(400, 'INVALID_CATALOG')
        items.append({'id': item_id, 'title': title, 'keywords': [_text(k, 20) for k in keywords[:20]]})
    return question, items


def build_messages(question, items):
    lines = '\n'.join(
        '%s｜%s｜%s' % (item['id'], item['title'], '、'.join(k for k in item['keywords'] if k))
        for item in items
    )
    system = (
        '你是 CMWebs 租屋管理系統的房東助理。只能從下列功能目錄挑一個最符合房東問題的功能代碼；都不符合就回 none。\n'
        '只回 JSON：{"id":"功能代碼或none","reply":"一句繁體中文口語回答"}。不要編造目錄以外的功能。\n'
        '功能目錄（代碼｜名稱｜常見說法）：\n' + lines
    )
    return [{'role': 'system', 'content': system}, {'role': 'user', 'content': question}]


def interpret(content, items):
    try:
        parsed = json.loads(content)
    except (TypeError, json.JSONDecodeError):
        raise BridgeError(502, 'MODEL_INVALID_OUTPUT')
    if not isinstance(parsed, dict):
        raise BridgeError(502, 'MODEL_INVALID_OUTPUT')
    chosen = _text(parsed.get('id'), 40)
    allowed = {item['id'] for item in items}
    if chosen not in allowed:
        chosen = 'none'
    return {'id': chosen, 'reply': _text(parsed.get('reply'), MAX_REPLY)}


def ask_model(config, question, items, opener=urllib.request.urlopen):
    body = json.dumps({
        'model': config['model'],
        'stream': False,
        'format': 'json',
        'think': False,
        'options': {'temperature': 0},
        'messages': build_messages(question, items),
    }).encode('utf-8')
    request = urllib.request.Request(
        config['model_url'] + '/api/chat',
        data=body,
        headers={'content-type': 'application/json'},
        method='POST',
    )
    if not _model_lock.acquire(timeout=QUEUE_WAIT_SECONDS):
        raise BridgeError(503, 'ASSISTANT_BUSY')
    try:
        with opener(request, timeout=config['timeout']) as response:
            data = json.loads(response.read().decode('utf-8'))
    except BridgeError:
        raise
    except Exception:
        raise BridgeError(504, 'MODEL_UNAVAILABLE')
    finally:
        _model_lock.release()
    message = data.get('message') if isinstance(data, dict) else None
    return interpret(message.get('content') if isinstance(message, dict) else None, items)


def make_handler(config, opener=urllib.request.urlopen):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'cmwebs-assistant-bridge'

        def log_message(self, format, *args):  # questions are never logged
            return

        def _send(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('content-type', 'application/json; charset=utf-8')
            self.send_header('content-length', str(len(body)))
            self.send_header('cache-control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == '/health':
                self._send(200, {'success': True})
            else:
                self._send(404, {'success': False, 'code': 'NOT_FOUND'})

        def do_POST(self):
            if self.path != '/v1/answer':
                self._send(404, {'success': False, 'code': 'NOT_FOUND'})
                return
            supplied = self.headers.get('authorization', '')
            supplied = supplied[7:].strip() if supplied.lower().startswith('bearer ') else ''
            if not config['token'] or not hmac.compare_digest(supplied, config['token']):
                self._send(401, {'success': False, 'code': 'UNAUTHORIZED'})
                return
            length = int(self.headers.get('content-length') or 0)
            if length <= 0 or length > MAX_BODY:
                self._send(413, {'success': False, 'code': 'BODY_TOO_LARGE'})
                return
            try:
                question, items = parse_request(self.rfile.read(length))
                self._send(200, {'success': True, 'data': ask_model(config, question, items, opener)})
            except BridgeError as error:
                self._send(error.status, {'success': False, 'code': error.code})

    return Handler


def main():
    config = load_config()
    if not config['token']:
        raise SystemExit('CMWEBS_ASSISTANT_TOKEN_FILE is required')
    if not config['model_url']:
        raise SystemExit('CMWEBS_ASSISTANT_MODEL_URL is required')
    server = ThreadingHTTPServer(('127.0.0.1', config['port']), make_handler(config))
    server.serve_forever()


if __name__ == '__main__':
    main()
