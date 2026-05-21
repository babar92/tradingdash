import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from data_source import get_source, list_sources
import sources.yfinance
import sources.hyperliquid

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BACKEND_DIR, '..', 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
app.config['SECRET_KEY'] = 'trading-dashboard-secret'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@app.after_request
def add_no_cache(resp):
    if resp.content_type and ('javascript' in resp.content_type or resp.content_type == 'text/css'):
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
    return resp

STOCK_SUBSCRIBERS = {}

@app.route('/api/sources')
def api_list_sources():
    return jsonify(list_sources())

@app.route('/api/symbols')
def api_list_symbols():
    source_name = request.args.get('source', 'yfinance')
    try:
        source = get_source(source_name)
        return jsonify(source.get_symbols())
    except KeyError:
        return jsonify({"error": f"Source '{source_name}' not found"}), 404

@app.route('/api/symbols-embedded')
def api_symbols_embedded():
    all_symbols = []
    for name in list_sources():
        try:
            src = get_source(name)
            for s in src.get_symbols():
                s['source'] = name
                all_symbols.append(s)
        except Exception:
            pass
    return jsonify(all_symbols)

@app.route('/api/ohlc')
def api_get_ohlc():
    source_name = request.args.get('source', 'yfinance')
    symbol = request.args.get('symbol', '')
    timeframe = request.args.get('timeframe', '1h')
    limit = int(request.args.get('limit', 500))
    try:
        source = get_source(source_name)
        data = source.get_ohlc(symbol, timeframe, limit)
        return jsonify(data)
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path='index.html'):
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    filepath = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

@socketio.on('connect')
def handle_connect():
    print(f"Client connected")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected")

@socketio.on('subscribe_stock')
def handle_subscribe_stock(data):
    symbol = data.get('symbol', '')
    if not symbol:
        return
    sid = request.sid
    if symbol not in STOCK_SUBSCRIBERS:
        STOCK_SUBSCRIBERS[symbol] = set()
    STOCK_SUBSCRIBERS[symbol].add(sid)
    source = get_source('yfinance')
    source.subscribe(symbol, lambda update, s=symbol: _broadcast_stock(s, sid, update))

def _broadcast_stock(symbol, sid, update):
    socketio.emit('price_update', update, room=sid)

@socketio.on('unsubscribe_stock')
def handle_unsubscribe_stock(data):
    symbol = data.get('symbol', '')
    sid = request.sid
    if symbol in STOCK_SUBSCRIBERS and sid in STOCK_SUBSCRIBERS[symbol]:
        STOCK_SUBSCRIBERS[symbol].discard(sid)

if __name__ == '__main__':
    print("Starting Trading Dashboard Backend on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
