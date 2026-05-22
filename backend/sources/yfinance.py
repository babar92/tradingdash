import yfinance as yf
import pandas as pd
import time
import threading

from data_source import register_source

YF_TIMEFRAMES = {
    '1m':  {'interval': '1m',  'period': '7d'},
    '5m':  {'interval': '5m',  'period': '1mo'},
    '15m': {'interval': '15m', 'period': '1mo'},
    '30m': {'interval': '30m', 'period': '2mo'},
    '1h':  {'interval': '60m', 'period': 'max'},
    '1d':  {'interval': '1d',  'period': 'max'},
    '1w':  {'interval': '1wk', 'period': 'max'},
    '1M':  {'interval': '1mo', 'period': 'max'},
}

AGGREGATE_TIMEFRAMES = {
    '3m':  {'base': '1m',  'minutes': 3},
    '2h':  {'base': '60m', 'minutes': 120},
    '4h':  {'base': '60m', 'minutes': 240},
    '6h':  {'base': '60m', 'minutes': 360},
    '12h': {'base': '60m', 'minutes': 720},
    '1y':  {'base': '1mo', 'months': 12},
}

SYMBOLS = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "asset_type": "stock"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "asset_type": "stock"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "asset_type": "stock"},
    {"symbol": "INFY.NS", "name": "Infosys", "asset_type": "stock"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "asset_type": "stock"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "asset_type": "stock"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "asset_type": "stock"},
    {"symbol": "ITC.NS", "name": "ITC Limited", "asset_type": "stock"},
    {"symbol": "WIPRO.NS", "name": "Wipro", "asset_type": "stock"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "asset_type": "stock"},
    {"symbol": "MSTR", "name": "MicroStrategy", "asset_type": "stock"},
    {"symbol": "OVH.PA", "name": "OVHcloud", "asset_type": "stock"},
    {"symbol": "SLV", "name": "iShares Silver Trust", "asset_type": "etf"},
    {"symbol": "BZ=F", "name": "Brent Crude Oil Futures", "asset_type": "commodity"},
    {"symbol": "TSLA", "name": "Tesla", "asset_type": "stock"},
    {"symbol": "AAPL", "name": "Apple", "asset_type": "stock"},
    {"symbol": "MSFT", "name": "Microsoft", "asset_type": "stock"},
    {"symbol": "GOOGL", "name": "Alphabet", "asset_type": "stock"},
    {"symbol": "AMZN", "name": "Amazon", "asset_type": "stock"},
    {"symbol": "NVDA", "name": "NVIDIA", "asset_type": "stock"},
]

def _to_epoch(dt):
    return int(dt.timestamp())

def _yf_to_standard(df):
    records = []
    for idx, row in df.iterrows():
        records.append({
            "time": _to_epoch(idx),
            "open": round(float(row['Open']), 2),
            "high": round(float(row['High']), 2),
            "low": round(float(row['Low']), 2),
            "close": round(float(row['Close']), 2),
            "volume": int(row['Volume']) if 'Volume' in row else 0
        })
    return records

@register_source('yfinance')
class YFinanceSource:
    def __init__(self):
        self._poll_callbacks = {}
        self._poll_threads = {}
        self._running = False

    def get_symbols(self):
        return SYMBOLS

    def get_ohlc(self, symbol, timeframe, limit=500):
        try:
            if timeframe in YF_TIMEFRAMES:
                config = YF_TIMEFRAMES[timeframe]
                ticker = yf.Ticker(symbol)
                df = ticker.history(period=config['period'], interval=config['interval'])
            elif timeframe in AGGREGATE_TIMEFRAMES:
                config = AGGREGATE_TIMEFRAMES[timeframe]
                if 'months' in config:
                    ticker = yf.Ticker(symbol)
                    df = ticker.history(period='max', interval=config['base'])
                    if not df.empty:
                        rule = f'{config["months"]}ME'
                        df = df.resample(rule).agg({
                            'Open': 'first', 'High': 'max',
                            'Low': 'min', 'Close': 'last', 'Volume': 'sum'
                        }).dropna()
                else:
                    ticker = yf.Ticker(symbol)
                    df = ticker.history(period='max', interval=config['base'])
                    if not df.empty:
                        rule = f'{config["minutes"]}min'
                        df = df.resample(rule).agg({
                            'Open': 'first', 'High': 'max',
                            'Low': 'min', 'Close': 'last', 'Volume': 'sum'
                        }).dropna()
            else:
                return []
            if df.empty:
                return []
            data = _yf_to_standard(df)
            return data[-limit:] if len(data) > limit else data
        except Exception as e:
            print(f"yfinance OHLC error for {symbol}: {e}")
            return []

    def get_price_summary(self, symbol):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            prev_close = info.get('regularMarketPreviousClose')
            if price and prev_close and prev_close > 0:
                change = price - prev_close
                change_percent = (change / prev_close) * 100
            else:
                data = ticker.history(period='2d', interval='1d')
                if len(data) >= 2:
                    prev_close = float(data['Close'].iloc[-2])
                    price = float(data['Close'].iloc[-1])
                    change = price - prev_close
                    change_percent = (change / prev_close) * 100
                elif len(data) == 1:
                    price = float(data['Close'].iloc[-1])
                    change = 0
                    change_percent = 0
                else:
                    return {"symbol": symbol, "price": 0, "change": 0, "changePercent": 0}

            return {
                "symbol": symbol,
                "price": round(price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2)
            }
        except Exception as e:
            print(f"yfinance price summary error for {symbol}: {e}")
            return {"symbol": symbol, "price": 0, "change": 0, "changePercent": 0}

    def subscribe(self, symbol, callback):
        if symbol not in self._poll_callbacks:
            self._poll_callbacks[symbol] = []
        self._poll_callbacks[symbol].append(callback)
        if symbol not in self._poll_threads or not self._poll_threads[symbol].is_alive():
            self._running = True
            t = threading.Thread(target=self._poll_loop, args=(symbol,), daemon=True)
            self._poll_threads[symbol] = t
            t.start()
        def unsubscribe():
            if symbol in self._poll_callbacks:
                self._poll_callbacks[symbol] = [cb for cb in self._poll_callbacks[symbol] if cb != callback]
        return unsubscribe

    def _poll_loop(self, symbol):
        ticker = yf.Ticker(symbol)
        prev_close = None
        while self._running and self._poll_callbacks.get(symbol):
            try:
                data = ticker.history(period='1d', interval='1m')
                if not data.empty:
                    last = data.iloc[-1]
                    price = round(float(last['Close']), 2)
                    ts = _to_epoch(last.name)
                    current_candle = {
                        "time": ts,
                        "open": round(float(last['Open']), 2),
                        "high": round(float(last['High']), 2),
                        "low": round(float(last['Low']), 2),
                        "close": price,
                        "volume": int(last['Volume'])
                    }
                    if prev_close is None:
                        prev_close = price
                    price_update = {
                        "symbol": symbol,
                        "price": price,
                        "change": round(price - prev_close, 2),
                        "changePercent": round((price - prev_close) / prev_close * 100, 2),
                        "timestamp": ts,
                        "candle": current_candle
                    }
                    prev_close = price
                    for cb in self._poll_callbacks.get(symbol, []):
                        cb(price_update)
            except Exception as e:
                print(f"yfinance poll error for {symbol}: {e}")
            time.sleep(5)

    def stop(self):
        self._running = False
