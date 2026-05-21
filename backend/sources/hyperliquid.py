import requests
import time
import threading
import json

from data_source import register_source

HL_API = "https://api.hyperliquid.xyz/info"

HL_TIMEFRAMES = {
    '1m':  '1m',
    '5m':  '5m',
    '15m': '15m',
    '1h':  '1h',
    '4h':  '4h',
    '1d':  '1d',
}

DEFAULT_SYMBOLS = [
    {"symbol": "BTC", "name": "Bitcoin", "asset_type": "crypto"},
    {"symbol": "ETH", "name": "Ethereum", "asset_type": "crypto"},
    {"symbol": "LINK", "name": "Chainlink", "asset_type": "crypto"},
    {"symbol": "TAO", "name": "Bittensor", "asset_type": "crypto"},
    {"symbol": "AKT", "name": "Akash Network", "asset_type": "crypto"},
    {"symbol": "MLC", "name": "MyLocalCoin", "asset_type": "crypto"},
    {"symbol": "BORG", "name": "SwissBorg", "asset_type": "crypto"},
    {"symbol": "SOL", "name": "Solana", "asset_type": "crypto"},
    {"symbol": "ARB", "name": "Arbitrum", "asset_type": "crypto"},
    {"symbol": "OP", "name": "Optimism", "asset_type": "crypto"},
    {"symbol": "DOGE", "name": "Dogecoin", "asset_type": "crypto"},
    {"symbol": "AVAX", "name": "Avalanche", "asset_type": "crypto"},
    {"symbol": "MATIC", "name": "Polygon", "asset_type": "crypto"},
    {"symbol": "ATOM", "name": "Cosmos", "asset_type": "crypto"},
]

def _to_epoch(ms_timestamp):
    return int(ms_timestamp / 1000)

@register_source('hyperliquid')
class HyperliquidSource:
    def __init__(self):
        self._symbols = DEFAULT_SYMBOLS
        self._ws_callbacks = {}

    def get_symbols(self):
        live_symbols = []
        try:
            resp = requests.post(HL_API, json={"type": "meta"}, timeout=5)
            if resp.status_code == 200:
                meta = resp.json()
                universe = meta.get('universe', [])
                if universe:
                    live_symbols = [
                        {"symbol": u['name'], "name": u['name'], "asset_type": "crypto"}
                        for u in universe
                    ]
        except Exception as e:
            print(f"Hyperliquid meta fetch error: {e}")

        merged = {s['symbol']: s for s in self._symbols}
        for s in live_symbols:
            if s['symbol'] not in merged:
                merged[s['symbol']] = s
        self._symbols = list(merged.values())
        return self._symbols

    def get_ohlc(self, symbol, timeframe, limit=500):
        if timeframe not in HL_TIMEFRAMES:
            if timeframe in ('3m', '2h', '6h', '12h'):
                return self._get_aggregated_ohlc(symbol, timeframe, limit)
            if timeframe == '1w':
                return self._get_aggregated_ohlc(symbol, timeframe, limit)
            if timeframe in ('1M', '1y'):
                return self._get_aggregated_ohlc(symbol, timeframe, limit)
            return []

        interval = HL_TIMEFRAMES[timeframe]
        now_ms = int(time.time() * 1000)

        duration_map = {'1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000}
        candle_ms = duration_map.get(timeframe, 3600000)
        start_ms = now_ms - (candle_ms * limit * 2)

        try:
            req = {
                "type": "candleSnapshot",
                "req": {
                    "coin": symbol,
                    "interval": interval,
                    "startTime": start_ms,
                    "endTime": now_ms
                }
            }
            resp = requests.post(HL_API, json=req, timeout=10)
            if resp.status_code == 200:
                candles = resp.json()
                if isinstance(candles, list):
                    result = []
                    for c in candles:
                        result.append({
                            "time": _to_epoch(c['t']),
                            "open": float(c['o']),
                            "high": float(c['h']),
                            "low": float(c['l']),
                            "close": float(c['c']),
                            "volume": float(c['v'])
                        })
                    return result[-limit:]
            return []
        except Exception as e:
            print(f"Hyperliquid OHLC error for {symbol}: {e}")
            return []

    def _get_aggregated_ohlc(self, symbol, timeframe, limit):
        base_tf_map = {
            '3m': ('1m', 3), '2h': ('1h', 2), '6h': ('1h', 6),
            '12h': ('1h', 12), '1w': ('1d', 7), '1M': ('1d', 30), '1y': ('1d', 365)
        }
        if timeframe not in base_tf_map:
            return []

        base_tf, multiplier = base_tf_map[timeframe]
        base_data = self.get_ohlc(symbol, base_tf, limit * multiplier * 2)
        if not base_data:
            return []

        aggregated = []
        for i in range(0, len(base_data), multiplier):
            chunk = base_data[i:i + multiplier]
            if len(chunk) == 0:
                continue
            agg = {
                "time": chunk[0]["time"],
                "open": chunk[0]["open"],
                "high": max(c["high"] for c in chunk),
                "low": min(c["low"] for c in chunk),
                "close": chunk[-1]["close"],
                "volume": sum(c["volume"] for c in chunk),
            }
            aggregated.append(agg)
        return aggregated[-limit:]

    def subscribe(self, symbol, callback):
        if symbol not in self._ws_callbacks:
            self._ws_callbacks[symbol] = []
        self._ws_callbacks[symbol].append(callback)
        def unsubscribe():
            if symbol in self._ws_callbacks:
                self._ws_callbacks[symbol] = [cb for cb in self._ws_callbacks[symbol] if cb != callback]
        return unsubscribe
