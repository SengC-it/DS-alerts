// 自动生成 - 来自消融实验数据
// 每个币种的最优 (策略, 时间框架, 维度组合)
// 生成时间: 2026-06-28T03:35:35.989Z

export interface CoinConfig {
  symbol: string;
  base: string;
  timeframe: string;
  strategy: string;
  dimensions: string[];
  totalPnl: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  maxDD: number;
  baselinePnl: number;
}

export const COIN_CONFIGS: CoinConfig[] = [
  {
    "symbol": "UB/USDT:USDT",
    "base": "UB",
    "timeframe": "4h",
    "strategy": "rsi_trend",
    "dimensions": [
      "OI",
      "btc_trend",
      "volatility"
    ],
    "totalPnl": 400.49863770284827,
    "profitFactor": 5.106931043927935,
    "winRate": 54.83870967741935,
    "totalTrades": 31,
    "maxDD": 21.81984918078925,
    "baselinePnl": 99.77163043237732
  },
  {
    "symbol": "BASED/USDT:USDT",
    "base": "BASED",
    "timeframe": "1h",
    "strategy": "rsi_trend",
    "dimensions": [
      "btc_trend"
    ],
    "totalPnl": 212.02591054208574,
    "profitFactor": 5.289211681336392,
    "winRate": 66.66666666666666,
    "totalTrades": 33,
    "maxDD": 28.93645416252643,
    "baselinePnl": 51.32452941799217
  },
  {
    "symbol": "BEAT/USDT:USDT",
    "base": "BEAT",
    "timeframe": "1h",
    "strategy": "ema_trend",
    "dimensions": [
      "mtf"
    ],
    "totalPnl": 168.0729160004703,
    "profitFactor": 6.348335999080807,
    "winRate": 69.23076923076923,
    "totalTrades": 26,
    "maxDD": 15.081397393518381,
    "baselinePnl": 83.60266743077209
  },
  {
    "symbol": "MYX/USDT:USDT",
    "base": "MYX",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "OI",
      "btc_trend"
    ],
    "totalPnl": 333.06222235444295,
    "profitFactor": 2.961617854017273,
    "winRate": 54.285714285714285,
    "totalTrades": 35,
    "maxDD": 71.45414900650722,
    "baselinePnl": 266.9795739529642
  },
  {
    "symbol": "LAB/USDT:USDT",
    "base": "LAB",
    "timeframe": "4h",
    "strategy": "rsi_trend",
    "dimensions": [
      "btc_trend"
    ],
    "totalPnl": 370.4738440077315,
    "profitFactor": 2.6162086138920984,
    "winRate": 48.717948717948715,
    "totalTrades": 39,
    "maxDD": 39.61652087171635,
    "baselinePnl": -339.0250035777935
  },
  {
    "symbol": "H/USDT:USDT",
    "base": "H",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "funding"
    ],
    "totalPnl": 304.1860945964017,
    "profitFactor": 2.5842561257563816,
    "winRate": 57.407407407407405,
    "totalTrades": 54,
    "maxDD": 43.24660327161389,
    "baselinePnl": 261.65568353148643
  },
  {
    "symbol": "DEXE/USDT:USDT",
    "base": "DEXE",
    "timeframe": "4h",
    "strategy": "bollinger_breakout",
    "dimensions": [
      "OI"
    ],
    "totalPnl": 247.3096687913833,
    "profitFactor": 2.8158756412428065,
    "winRate": 60.37735849056604,
    "totalTrades": 53,
    "maxDD": 28.553248135721976,
    "baselinePnl": 236.92282258483027
  },
  {
    "symbol": "GUA/USDT:USDT",
    "base": "GUA",
    "timeframe": "4h",
    "strategy": "ema_trend",
    "dimensions": [
      "btc_trend",
      "volatility"
    ],
    "totalPnl": 208.99025800925327,
    "profitFactor": 3.2956036820706833,
    "winRate": 60,
    "totalTrades": 25,
    "maxDD": 60.899857950174116,
    "baselinePnl": -37.417403198337524
  },
  {
    "symbol": "MMT/USDT:USDT",
    "base": "MMT",
    "timeframe": "1h",
    "strategy": "rsi_trend",
    "dimensions": [
      "mtf"
    ],
    "totalPnl": 148.72638297681925,
    "profitFactor": 4.3212899562014995,
    "winRate": 66.66666666666666,
    "totalTrades": 57,
    "maxDD": 13.486727089731145,
    "baselinePnl": -4.269376233449643
  },
  {
    "symbol": "SLX/USDT:USDT",
    "base": "SLX",
    "timeframe": "1h",
    "strategy": "breakout",
    "dimensions": [
      "mtf"
    ],
    "totalPnl": 186.00351988304726,
    "profitFactor": 3.223024215352501,
    "winRate": 60.71428571428571,
    "totalTrades": 28,
    "maxDD": 32.752017594903094,
    "baselinePnl": 181.89619195429717
  },
  {
    "symbol": "PORTAL/USDT:USDT",
    "base": "PORTAL",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "volume"
    ],
    "totalPnl": 175.0265627934714,
    "profitFactor": 3.1104626061292517,
    "winRate": 51.515151515151516,
    "totalTrades": 33,
    "maxDD": 16.793323770979985,
    "baselinePnl": 116.09897665795606
  },
  {
    "symbol": "FARTCOIN/USDT:USDT",
    "base": "FARTCOIN",
    "timeframe": "4h",
    "strategy": "bollinger_breakout",
    "dimensions": [
      "volatility"
    ],
    "totalPnl": 193.55602447376344,
    "profitFactor": 2.581212093956784,
    "winRate": 56.81818181818182,
    "totalTrades": 44,
    "maxDD": 47.723849875986346,
    "baselinePnl": 180.86897262602727
  },
  {
    "symbol": "GRASS/USDT:USDT",
    "base": "GRASS",
    "timeframe": "4h",
    "strategy": "rsi_trend",
    "dimensions": [
      "btc_trend"
    ],
    "totalPnl": 166.8359074662042,
    "profitFactor": 2.787462111279301,
    "winRate": 56.25,
    "totalTrades": 32,
    "maxDD": 37.3752032553198,
    "baselinePnl": 63.33895016644857
  },
  {
    "symbol": "DASH/USDT:USDT",
    "base": "DASH",
    "timeframe": "4h",
    "strategy": "macd_cross",
    "dimensions": [
      "mtf"
    ],
    "totalPnl": 186.86250331547592,
    "profitFactor": 2.4293879024835694,
    "winRate": 49.09090909090909,
    "totalTrades": 55,
    "maxDD": 14.982695370710797,
    "baselinePnl": 186.86250331547592
  },
  {
    "symbol": "CLO/USDT:USDT",
    "base": "CLO",
    "timeframe": "1h",
    "strategy": "breakout",
    "dimensions": [
      "btc_trend"
    ],
    "totalPnl": 182.3747440011353,
    "profitFactor": 2.381260573876604,
    "winRate": 55.55555555555556,
    "totalTrades": 45,
    "maxDD": 27.73514255828311,
    "baselinePnl": 133.0308664974761
  },
  {
    "symbol": "ESPORTS/USDT:USDT",
    "base": "ESPORTS",
    "timeframe": "4h",
    "strategy": "macd_cross",
    "dimensions": [
      "OI"
    ],
    "totalPnl": 203.15007001289277,
    "profitFactor": 1.8805179084959882,
    "winRate": 38.333333333333336,
    "totalTrades": 60,
    "maxDD": 47.7104227865152,
    "baselinePnl": 161.5786236405408
  },
  {
    "symbol": "AIN/USDT:USDT",
    "base": "AIN",
    "timeframe": "4h",
    "strategy": "rsi_trend",
    "dimensions": [
      "volume"
    ],
    "totalPnl": 150.57404880289866,
    "profitFactor": 2.5316233515284896,
    "winRate": 53.84615384615385,
    "totalTrades": 26,
    "maxDD": 19.558466053441677,
    "baselinePnl": 51.49818542344282
  },
  {
    "symbol": "IP/USDT:USDT",
    "base": "IP",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "volatility"
    ],
    "totalPnl": 143.06630345818522,
    "profitFactor": 2.6193804319826435,
    "winRate": 54.054054054054056,
    "totalTrades": 37,
    "maxDD": 28.855961090318804,
    "baselinePnl": 71.12437894146177
  },
  {
    "symbol": "BAS/USDT:USDT",
    "base": "BAS",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "volume"
    ],
    "totalPnl": 150.5973196685305,
    "profitFactor": 1.8586419444640807,
    "winRate": 53.125,
    "totalTrades": 32,
    "maxDD": 75.56650187386353,
    "baselinePnl": -16.527398717353663
  },
  {
    "symbol": "RESOLV/USDT:USDT",
    "base": "RESOLV",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "OI"
    ],
    "totalPnl": 160.65822195636215,
    "profitFactor": 1.646758151856579,
    "winRate": 39.34426229508197,
    "totalTrades": 61,
    "maxDD": 88.2989305426426,
    "baselinePnl": 149.95600785834046
  },
  {
    "symbol": "STG/USDT:USDT",
    "base": "STG",
    "timeframe": "4h",
    "strategy": "breakout",
    "dimensions": [
      "OI"
    ],
    "totalPnl": 151.71832754706537,
    "profitFactor": 1.6773850899882432,
    "winRate": 45.588235294117645,
    "totalTrades": 68,
    "maxDD": 38.30950571366217,
    "baselinePnl": 142.28781296343638
  },
  {
    "symbol": "SIREN/USDT:USDT",
    "base": "SIREN",
    "timeframe": "4h",
    "strategy": "bollinger_breakout",
    "dimensions": [
      "funding"
    ],
    "totalPnl": 145.2817488313858,
    "profitFactor": 1.4095526944138905,
    "winRate": 37.77777777777778,
    "totalTrades": 45,
    "maxDD": 68.97095057355533,
    "baselinePnl": 66.30562532613355
  }
];

// 策略→推荐维度映射 (用于不在配置表中的币种)
export const STRATEGY_DIM_MAP: Record<string, string[]> = {
  rsi_trend: ['btc_trend', 'mtf'],
  macd_cross: ['btc_trend', 'mtf'],
  ema_cross: ['btc_trend', 'mtf'],
  ema_rsi: ['btc_trend', 'mtf'],
  ema_trend: ['mtf', 'btc_trend'],
  breakout: ['mtf', 'volatility'],
  bollinger_breakout: ['mtf', 'volatility'],
  rsi_reversion: ['OI', 'volume'],
};
