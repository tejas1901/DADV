// ============================================================
// disaster/mlEngine.js — AI Weather Forecasting Engine
// Implements: Exponential Smoothing + Seasonal Decomposition
//             + Linear Regression (ensemble — no Python needed)
// ============================================================

class WeatherMLEngine {
  constructor(historicalData, liveWeather = null) {
    // Sort ascending by date
    this.data = [...historicalData].sort((a, b) => new Date(a.date) - new Date(b.date));
    this.live = liveWeather;
    this.alpha = 0.3;  // Exponential smoothing factor

    const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    this.DAY_NAMES   = DAY_NAMES;
    this.MONTH_NAMES = MONTH_NAMES;
  }

  // ── Utilities ────────────────────────────────────────────────

  getDayOfYear(date) {
    const d   = new Date(date);
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  round1(v) { return Math.round(v * 10) / 10; }

  addNoise(val, range) {
    return val + (Math.random() * range * 2 - range);
  }

  // ── Core Statistical Methods ─────────────────────────────────

  exponentialSmoothing(values) {
    if (!values.length) return [];
    const res = [values[0]];
    for (let i = 1; i < values.length; i++) {
      res.push(this.alpha * values[i] + (1 - this.alpha) * res[i - 1]);
    }
    return res;
  }

  linearRegression(xArr, yArr) {
    const n    = xArr.length;
    if (n < 2) return { slope: 0, intercept: yArr[0] || 0 };
    const sumX  = xArr.reduce((a, b) => a + b, 0);
    const sumY  = yArr.reduce((a, b) => a + b, 0);
    const sumXY = xArr.reduce((acc, x, i) => acc + x * yArr[i], 0);
    const sumX2 = xArr.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n };
    const slope     = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  // ── Seasonal Average for a Given Day-of-Year ─────────────────
  // Looks back across all years for the ±20-day window around that DOY
  getSeasonalAverage(doy, field) {
    const WINDOW = 20;
    const relevant = this.data.filter(d => {
      if (d[field] == null) return false;
      const ddoy = this.getDayOfYear(new Date(d.date));
      const diff = Math.abs(ddoy - doy);
      return diff <= WINDOW || diff >= 365 - WINDOW;
    });
    if (!relevant.length) return null;
    const vals = relevant.map(d => d[field]);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // ── Predict One Field for a Future Date ──────────────────────
  predictField(targetDate, field) {
    const tgt = new Date(targetDate);
    const doy = this.getDayOfYear(tgt);

    // Component A — Exponential smoothing on last 60 records
    const recent = this.data.slice(-60).map(d => d[field]).filter(v => v != null);
    const smoothed = this.exponentialSmoothing(recent);
    const compA = smoothed.length ? smoothed[smoothed.length - 1] : 0;

    // Component B — Seasonal average (same DOY across all years)
    const compB = this.getSeasonalAverage(doy, field) ?? compA;

    // Component C — 14-day linear trend extrapolation
    const last14 = this.data.slice(-14).filter(d => d[field] != null);
    const xVals = last14.map((_, i) => i);
    const yVals = last14.map(d => d[field]);
    const { slope, intercept } = this.linearRegression(xVals, yVals);
    const daysAhead = Math.max(1, Math.round(
      (tgt - new Date(last14[last14.length - 1]?.date || Date.now())) / 86400000
    ));
    const compC = intercept + slope * (last14.length - 1 + daysAhead);

    // Ensemble: 40% seasonal + 35% smoothing + 25% trend
    return 0.35 * compA + 0.40 * compB + 0.25 * compC;
  }

  // ── Derive Rainfall Probability ───────────────────────────────
  rainfallProbability(humidity, cloudCoverage, rainfall, windSpeed) {
    let prob = 0;
    if (humidity > 85)      prob += 35;
    else if (humidity > 75) prob += 20;
    else if (humidity > 65) prob += 10;

    if (cloudCoverage > 75)      prob += 30;
    else if (cloudCoverage > 55) prob += 18;
    else if (cloudCoverage > 35) prob += 8;

    if (rainfall > 10)      prob += 25;
    else if (rainfall > 2)  prob += 12;

    if (windSpeed > 40)     prob += 10;

    prob += this.addNoise(0, 5);
    return this.clamp(Math.round(prob), 0, 100);
  }

  // ── Cloud Condition Label ─────────────────────────────────────
  getConditionLabel(cloudCoverage, rainfall) {
    if (rainfall > 80)  return 'Heavy Rain';
    if (rainfall > 30)  return 'Rainy';
    if (rainfall > 8)   return 'Light Rain';
    if (rainfall > 1)   return 'Drizzle';
    if (cloudCoverage > 85) return 'Overcast';
    if (cloudCoverage > 65) return 'Mostly Cloudy';
    if (cloudCoverage > 35) return 'Partly Cloudy';
    if (cloudCoverage > 15) return 'Mostly Clear';
    return 'Clear Sky';
  }

  // ── Disaster Risk Scorer ──────────────────────────────────────
  scoreDisasterRisk(p, prevRainfalls = []) {
    const { predictedTemp, rainfallProbability: rp, predictedRainfall: rain,
            humidity, windSpeed, pressure } = p;

    const risk = {
      floodRisk:     'Low',
      cycloneAlert:  'None',
      heatwave:      'None',
      landslide:     'Low',
      droughtWarning:'None',
      overallLevel:  'Low',
      overallScore:  0,
    };

    let score = 0;

    // ── FLOOD RISK ───────────────────────────────────────────
    const priorTotal = prevRainfalls.reduce((a, b) => a + b, 0);
    if (rain > 150 || (rp > 88 && humidity > 90) || priorTotal > 300) {
      risk.floodRisk = 'Extreme'; score += 40;
    } else if (rain > 80 || (rp > 72 && humidity > 85)) {
      risk.floodRisk = 'High';    score += 25;
    } else if (rain > 30 || rp > 55) {
      risk.floodRisk = 'Moderate'; score += 10;
    }

    // ── CYCLONE ALERT ────────────────────────────────────────
    if (windSpeed > 90 && pressure < 970) {
      risk.cycloneAlert = 'Extreme';  score += 50;
    } else if (windSpeed > 65 && pressure < 982) {
      risk.cycloneAlert = 'Warning';  score += 32;
    } else if (windSpeed > 45 && pressure < 992) {
      risk.cycloneAlert = 'Watch';    score += 15;
    }

    // ── HEATWAVE ─────────────────────────────────────────────
    if (predictedTemp > 45) {
      risk.heatwave = 'Extreme';  score += 38;
    } else if (predictedTemp > 42) {
      risk.heatwave = 'Severe';   score += 22;
    } else if (predictedTemp > 38) {
      risk.heatwave = 'Moderate'; score += 9;
    }

    // ── LANDSLIDE ────────────────────────────────────────────
    if (rain > 120 && humidity > 90 && priorTotal > 200) {
      risk.landslide = 'Extreme'; score += 30;
    } else if (rain > 70 && humidity > 82) {
      risk.landslide = 'High';    score += 16;
    } else if (rain > 35) {
      risk.landslide = 'Moderate'; score += 6;
    }

    // ── DROUGHT ──────────────────────────────────────────────
    if (rp < 5 && predictedTemp > 37 && priorTotal < 5) {
      risk.droughtWarning = 'Severe';   score += 28;
    } else if (rp < 15 && predictedTemp > 33) {
      risk.droughtWarning = 'Moderate'; score += 12;
    } else if (rp < 25) {
      risk.droughtWarning = 'Mild';     score += 4;
    }

    risk.overallScore = Math.min(100, score);
    if (score >= 60)      risk.overallLevel = 'Extreme';
    else if (score >= 35) risk.overallLevel = 'High';
    else if (score >= 15) risk.overallLevel = 'Moderate';

    return risk;
  }

  // ── Main: Generate 90-Day Forecast ───────────────────────────
  generateForecast(days = 90) {
    const forecast = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If we have live weather, inject it to tune predictions
    const liveTemp = this.live?.temperature;

    const prevRainfalls = []; // rolling window of last 7 days

    for (let i = 1; i <= days; i++) {
      const fd = new Date(today);
      fd.setDate(today.getDate() + i);

      // Raw predictions
      let temp        = this.predictField(fd, 'temperature');
      let humidity    = this.predictField(fd, 'humidity');
      let rainfall    = this.predictField(fd, 'rainfall');
      let windSpeed   = this.predictField(fd, 'windSpeed');
      let pressure    = this.predictField(fd, 'pressure');
      let cloudCov    = this.predictField(fd, 'cloudCoverage');

      // Apply live-weather bias correction for first 7 days
      if (liveTemp && i <= 7) {
        const bias = (liveTemp - temp) * (1 - i / 8);
        temp += bias;
      }

      // Add realistic noise
      temp      = this.addNoise(temp,      1.2);
      humidity  = this.addNoise(humidity,  3);
      rainfall  = Math.max(0, this.addNoise(rainfall, 4));
      windSpeed = Math.max(0, this.addNoise(windSpeed, 2));
      pressure  = this.addNoise(pressure,  2);
      cloudCov  = this.addNoise(cloudCov,  5);

      // Clamp to physical bounds
      temp      = this.clamp(this.round1(temp),      10, 50);
      humidity  = this.clamp(Math.round(humidity),   20, 100);
      rainfall  = this.clamp(this.round1(rainfall),  0, 300);
      windSpeed = this.clamp(this.round1(windSpeed), 0, 120);
      pressure  = this.clamp(Math.round(pressure),   950, 1030);
      cloudCov  = this.clamp(Math.round(cloudCov),   0, 100);

      const rp = this.rainfallProbability(humidity, cloudCov, rainfall, windSpeed);
      const condition = this.getConditionLabel(cloudCov, rainfall);

      const prediction = {
        date:                fd,
        dayOfWeek:           this.DAY_NAMES[fd.getDay()],
        day:                 fd.getDate(),
        month:               fd.getMonth() + 1,
        monthName:           this.MONTH_NAMES[fd.getMonth()],
        year:                fd.getFullYear(),
        predictedTemp:       temp,
        predictedTempMax:    this.clamp(this.round1(temp + 2.5), 10, 52),
        predictedTempMin:    this.clamp(this.round1(temp - 3.5), 5, 48),
        rainfallProbability: rp,
        predictedRainfall:   rainfall,
        humidity,
        cloudCondition:      condition,
        cloudCoverage:       cloudCov,
        windSpeed,
        pressure,
        condition,
      };

      // Rolling 7-day rainfall buffer
      prevRainfalls.push(rainfall);
      if (prevRainfalls.length > 7) prevRainfalls.shift();

      prediction.disasterRisk = this.scoreDisasterRisk(prediction, [...prevRainfalls]);
      forecast.push(prediction);
    }

    return forecast;
  }
}

module.exports = WeatherMLEngine;
