class Indicators {
  static sma(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[i - j].close;
      result.push({ time: data[i].time, value: sum / period });
    }
    return result;
  }

  static ema(data, period) {
    const k = 2 / (period + 1);
    const result = [];
    let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
    result.push({ time: data[period - 1].time, value: ema });
    for (let i = period; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
      result.push({ time: data[i].time, value: ema });
    }
    return result;
  }

  static rsi(data, period = 14) {
    const result = [];
    if (data.length < period + 1) return result;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[period].time, value: rsi });

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
      result.push({ time: data[i].time, value: rsi });
    }
    return result;
  }

  static macd(data, fast = 12, slow = 26, signal = 9) {
    const emaFast = Indicators.ema(data, fast);
    const emaSlow = Indicators.ema(data, slow);
    const macdLine = [];
    const minLen = Math.min(emaFast.length, emaSlow.length);
    const offset = emaFast.length - minLen;
    for (let i = 0; i < minLen; i++) {
      macdLine.push({
        time: emaFast[i + offset].time,
        value: emaFast[i + offset].value - emaSlow[i].value
      });
    }
    const signalLine = Indicators.ema(
      macdLine.map(m => ({ time: m.time, close: m.value })),
      signal
    );
    const histogram = [];
    const minLen2 = Math.min(macdLine.length, signalLine.length);
    const sigOffset = macdLine.length - minLen2;
    for (let i = 0; i < minLen2; i++) {
      histogram.push({
        time: macdLine[i + sigOffset].time,
        value: macdLine[i + sigOffset].value - signalLine[i].value
      });
    }
    return { macdLine, signalLine, histogram };
  }

  static bollinger(data, period = 20, multiplier = 2) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((s, d) => s + d.close, 0) / period;
      const variance = slice.reduce((s, d) => s + (d.close - mean) ** 2, 0) / period;
      const std = Math.sqrt(variance);
      result.push({
        time: data[i].time,
        middle: mean,
        upper: mean + multiplier * std,
        lower: mean - multiplier * std
      });
    }
    return result;
  }

  static volume(data) {
    return data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)'
    }));
  }

  static ichimoku(data) {
    if (data.length < 52) return null;
    const n = data.length;
    const times = data.map(d => d.time);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);

    const tenkan = [];
    const kijun = [];
    const spanA = [];
    const spanB = [];
    const chikou = [];

    for (let i = 8; i < n; i++) {
      const h = Math.max(...highs.slice(i - 8, i + 1));
      const l = Math.min(...lows.slice(i - 8, i + 1));
      tenkan.push({ time: times[i], value: (h + l) / 2 });
    }

    for (let i = 25; i < n; i++) {
      const h = Math.max(...highs.slice(i - 25, i + 1));
      const l = Math.min(...lows.slice(i - 25, i + 1));
      kijun.push({ time: times[i], value: (h + l) / 2 });
    }

    const avgInterval = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 3600;
    const futureTime = (idx) => idx < n ? times[idx] : Math.round(times[n - 1] + avgInterval * (idx - n + 1));

    for (let i = 26; i < n; i++) {
      const tenkanIdx = i - 8;
      const kijunIdx = i - 25;
      if (tenkanIdx < tenkan.length && kijunIdx < kijun.length) {
        spanA.push({ time: futureTime(i + 26), value: (tenkan[tenkanIdx].value + kijun[kijunIdx].value) / 2 });
      }
    }

    for (let i = 51; i < n; i++) {
      const h = Math.max(...highs.slice(i - 51, i + 1));
      const l = Math.min(...lows.slice(i - 51, i + 1));
      spanB.push({ time: futureTime(i + 26), value: (h + l) / 2 });
    }

    for (let i = 26; i < n; i++) {
      chikou.push({ time: times[i - 26], value: closes[i] });
    }

    const cloud = [];
    const minCloudLen = Math.min(spanA.length, spanB.length);
    for (let i = 0; i < minCloudLen; i++) {
      cloud.push({
        time: spanA[i].time,
        top: Math.max(spanA[i].value, spanB[i].value),
        bottom: Math.min(spanA[i].value, spanB[i].value),
        isGreen: spanA[i].value >= spanB[i].value
      });
    }

    return { tenkan, kijun, spanA, spanB, chikou, cloud };
  }
}
