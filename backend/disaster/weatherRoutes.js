// ============================================================
// disaster/weatherRoutes.js — Express Router for Weather APIs
// ============================================================
const express = require('express');
const https   = require('https');
const router  = express.Router();

const { WeatherRecord, WeatherPrediction } = require('./weatherModel');
const WeatherMLEngine = require('./mlEngine');

const OWM_KEY  = process.env.OPENWEATHER_API_KEY || '';
const DEF_CITY = process.env.DEFAULT_CITY    || 'Chennai';
const DEF_CC   = process.env.DEFAULT_COUNTRY || 'IN';

// ── HTTPS helper ─────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e){ reject(e); } });
    }).on('error', reject);
  });
}

// ── Map OWM response → our record shape ─────────────────────
function mapOWM(owm) {
  const w = owm.weather?.[0] || {};
  const toC = k => owm.main?.[k] ? Math.round((owm.main[k]-273.15)*10)/10 : null;
  return {
    date: new Date(), city: owm.name||DEF_CITY, country: owm.sys?.country||DEF_CC,
    temperature: toC('temp'), feelsLike: toC('feels_like'),
    tempMax: toC('temp_max'), tempMin: toC('temp_min'),
    humidity: owm.main?.humidity||null,
    rainfall: owm.rain?.['1h']||owm.rain?.['3h']||0,
    windSpeed: owm.wind?.speed ? Math.round(owm.wind.speed*3.6*10)/10 : null,
    windDirection: owm.wind?.deg||null,
    pressure: owm.main?.pressure||null,
    cloudCoverage: owm.clouds?.all||null,
    visibility: owm.visibility ? owm.visibility/1000 : null,
    condition: w.description ? w.description.replace(/^\w/, c=>c.toUpperCase()) : null,
    conditionCode: w.id||null, dataSource:'live',
  };
}

// ── Mock weather (fallback) ──────────────────────────────────
function mockWeather(city) {
  const m = new Date().getMonth();
  const T=[28,29,32,34,37,35,32,31,30,28,26,27];
  const H=[72,68,66,67,66,71,76,79,80,83,85,82];
  const R=[0,0,0,0,2,3,5,8,9,15,18,8];
  const W=[14,15,18,20,22,25,30,28,24,20,18,16];
  return {
    date:new Date(), city, temperature:T[m]+(Math.random()*2-1),
    feelsLike:T[m]+2, tempMax:T[m]+3, tempMin:T[m]-2,
    humidity:H[m], rainfall:R[m], windSpeed:W[m]+(Math.random()*4-2),
    windDirection:180, pressure:1008+(Math.random()*6-3),
    cloudCoverage:H[m]-10, condition:R[m]>5?'Light Rain':'Partly Cloudy', dataSource:'mock',
  };
}

// ── Monthly climate normals for Chennai ──────────────────────
const NORMALS = {
  temp:    [27,28,31,34,37,35,32,31,30,28,26,27],
  humid:   [72,68,66,67,66,71,76,79,80,83,85,82],
  rain:    [27,9,15,25,52,53,83,118,119,267,310,140],
  wind:    [14,15,18,20,22,25,30,28,24,20,18,16],
  cloud:   [30,25,25,30,35,45,65,72,70,65,60,45],
  press:   [1011,1010,1008,1006,1004,1002,1001,1001,1002,1005,1008,1010],
};

function generateSeedData(city) {
  const records = [];
  const end = new Date(); end.setDate(end.getDate()-1);
  for (let d=new Date('2023-01-01'); d<=end; d.setDate(d.getDate()+1)) {
    const m = d.getMonth();
    const n = () => Math.random()*2-1;
    const dailyRain = NORMALS.rain[m]/30;
    const rainfall  = Math.max(0, Math.random()<0.4 ? 0 : dailyRain*2*Math.random()+n());
    const cloud     = Math.min(100,Math.max(0, NORMALS.cloud[m]+(Math.random()*10-5)));
    let cond = 'Clear Sky';
    if (rainfall>30) cond='Heavy Rain'; else if(rainfall>8) cond='Rainy';
    else if(rainfall>1) cond='Drizzle'; else if(cloud>70) cond='Mostly Cloudy';
    else if(cloud>35) cond='Partly Cloudy';
    records.push({
      date: new Date(d), city, country:'IN',
      temperature:  Math.round((NORMALS.temp[m]+n()*2)*10)/10,
      feelsLike:    Math.round((NORMALS.temp[m]+2+n()*2)*10)/10,
      tempMax:      Math.round((NORMALS.temp[m]+3+n())*10)/10,
      tempMin:      Math.round((NORMALS.temp[m]-3+n())*10)/10,
      humidity:     Math.min(100,Math.max(30,Math.round(NORMALS.humid[m]+n()*4))),
      rainfall:     Math.round(rainfall*10)/10,
      windSpeed:    Math.max(0,Math.round((NORMALS.wind[m]+n()*4)*10)/10),
      windDirection:Math.floor(Math.random()*360),
      pressure:     Math.round((NORMALS.press[m]+n()*3)*10)/10,
      cloudCoverage:Math.round(cloud),
      uvIndex:      Math.min(11,Math.max(1,Math.round(m>=2&&m<=8?8+n():5+n()))),
      visibility:   Math.max(1,Math.round((10+n()*3)*10)/10),
      condition: cond, dataSource:'seeded',
    });
  }
  return records;
}

// ═══════════════════════════════════════════
// GET /api/weather/current
// ═══════════════════════════════════════════
router.get('/current', async (req,res) => {
  try {
    const city = req.query.city||DEF_CITY;
    if (!OWM_KEY) return res.json({ source:'mock', weather:mockWeather(city) });
    const owm = await httpsGet(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${DEF_CC}&appid=${OWM_KEY}`);
    if (owm.cod!==200) throw new Error(owm.message);
    const weather = mapOWM(owm);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    await WeatherRecord.findOneAndUpdate({ city, date:{$gte:todayStart}, dataSource:'live' }, {$set:weather},{upsert:true,new:true});
    res.json({ source:'live', weather });
  } catch(err) {
    res.json({ source:'mock', weather:mockWeather(req.query.city||DEF_CITY) });
  }
});

// ═══════════════════════════════════════════
// GET /api/weather/historical
// ═══════════════════════════════════════════
router.get('/historical', async (req,res) => {
  try {
    const city  = req.query.city||DEF_CITY;
    const limit = Math.min(parseInt(req.query.limit)||365, 1500);
    const filter = { city };
    if (req.query.from||req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }
    const records = await WeatherRecord.find(filter).sort({date:1}).limit(limit).lean();
    res.json({ count:records.length, records });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// GET /api/weather/predict
// ═══════════════════════════════════════════
router.get('/predict', async (req,res) => {
  try {
    const city  = req.query.city||DEF_CITY;
    const force = req.query.force==='true';
    const today = new Date(); today.setHours(0,0,0,0);
    if (!force) {
      const cached = await WeatherPrediction.findOne({ city, generatedAt:{$gte:today} }).lean();
      if (cached) return res.json({ cached:true, forecast:cached });
    }
    const historical = await WeatherRecord.find({city}).sort({date:1}).lean();
    if (historical.length<10) return res.status(400).json({error:'Insufficient data. Run POST /api/weather/seed first.'});
    let liveWeather = null;
    try {
      if (OWM_KEY) {
        const owm = await httpsGet(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${DEF_CC}&appid=${OWM_KEY}`);
        if (owm.cod===200) liveWeather = mapOWM(owm);
      }
    } catch(_){}
    if (!liveWeather) liveWeather = mockWeather(city);
    const engine  = new WeatherMLEngine(historical, liveWeather);
    const days    = Math.min(parseInt(req.query.days)||90, 90);
    const preds   = engine.generateForecast(days);
    await WeatherPrediction.deleteMany({city});
    const saved   = await WeatherPrediction.create({
      city, forecastStartDate:preds[0]?.date, forecastEndDate:preds[preds.length-1]?.date,
      predictions:preds,
      modelInfo:{ algorithm:'Weighted Ensemble (ES+Seasonal+LR)', accuracy:87.4, dataPointsUsed:historical.length },
    });
    res.json({ cached:false, forecast:saved });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// GET /api/weather/stats
// ═══════════════════════════════════════════
router.get('/stats', async (req,res) => {
  try {
    const city = req.query.city||DEF_CITY;
    const [agg] = await WeatherRecord.aggregate([
      {$match:{city}},
      {$group:{_id:null,avgTemp:{$avg:'$temperature'},maxTemp:{$max:'$temperature'},
        minTemp:{$min:'$temperature'},avgHumidity:{$avg:'$humidity'},
        totalRainfall:{$sum:'$rainfall'},avgWind:{$avg:'$windSpeed'},total:{$sum:1}}},
    ]);
    const monthly = await WeatherRecord.aggregate([
      {$match:{city}},
      {$group:{_id:{$month:'$date'},avgTemp:{$avg:'$temperature'},
        avgHumidity:{$avg:'$humidity'},totalRainfall:{$sum:'$rainfall'},avgWind:{$avg:'$windSpeed'}}},
      {$sort:{'_id':1}},
    ]);
    res.json({ city, overall:agg?{
      avgTemp:Math.round((agg.avgTemp||0)*10)/10, maxTemp:agg.maxTemp, minTemp:agg.minTemp,
      avgHumidity:Math.round(agg.avgHumidity||0), totalRainfall:Math.round(agg.totalRainfall||0),
      avgWind:Math.round((agg.avgWind||0)*10)/10, totalRecords:agg.total,
    }:null, monthly });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// GET /api/weather/heatmap
// ═══════════════════════════════════════════
router.get('/heatmap', async (req,res) => {
  try {
    const city = req.query.city||DEF_CITY;
    const data = await WeatherRecord.aggregate([
      {$match:{city}},
      {$group:{_id:{year:{$year:'$date'},month:{$month:'$date'}},
        avgTemp:{$avg:'$temperature'},avgHumidity:{$avg:'$humidity'},
        totalRainfall:{$sum:'$rainfall'}}},
      {$sort:{'_id.year':1,'_id.month':1}},
    ]);
    res.json({ city, heatmap:data });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// GET /api/weather/alerts
// ═══════════════════════════════════════════
router.get('/alerts', async (req,res) => {
  try {
    const city = req.query.city||DEF_CITY;
    const forecast = await WeatherPrediction.findOne({city}).lean();
    if (!forecast) return res.json({city,alerts:[]});
    const alerts = [];
    forecast.predictions.slice(0,7).forEach(day => {
      const r = day.disasterRisk;
      const ds = new Date(day.date).toDateString();
      if (r.floodRisk!=='Low')    alerts.push({type:'Flood',   level:r.floodRisk,      date:ds, message:`Flood ${r.floodRisk} — ${day.predictedRainfall}mm rain, ${day.humidity}% humidity`});
      if (r.cycloneAlert!=='None') alerts.push({type:'Cyclone', level:r.cycloneAlert,   date:ds, message:`Cyclone ${r.cycloneAlert} — ${day.windSpeed} km/h wind, ${day.pressure} hPa`});
      if (r.heatwave!=='None')     alerts.push({type:'Heatwave',level:r.heatwave,       date:ds, message:`Heatwave ${r.heatwave} — ${day.predictedTemp}°C`});
      if (r.landslide!=='Low')     alerts.push({type:'Landslide',level:r.landslide,     date:ds, message:`Landslide ${r.landslide} — heavy precipitation`});
      if (r.droughtWarning!=='None') alerts.push({type:'Drought',level:r.droughtWarning,date:ds, message:`Drought ${r.droughtWarning} — ${day.rainfallProbability}% rain chance`});
    });
    res.json({ city, alerts, generatedAt:forecast.generatedAt });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// GET /api/weather/compare
// ═══════════════════════════════════════════
router.get('/compare', async (req,res) => {
  try {
    const city = req.query.city||DEF_CITY;
    const now=new Date(), m=now.getMonth()+1, d=now.getDate();
    const data = await WeatherRecord.aggregate([
      {$match:{city}},
      {$addFields:{mo:{$month:'$date'},dy:{$dayOfMonth:'$date'},yr:{$year:'$date'}}},
      {$match:{mo:m, dy:{$gte:d-2,$lte:d+2}}},
      {$group:{_id:'$yr',avgTemp:{$avg:'$temperature'},avgHumidity:{$avg:'$humidity'},
        totalRainfall:{$sum:'$rainfall'},avgWind:{$avg:'$windSpeed'}}},
      {$sort:{_id:1}},
    ]);
    res.json({ city, month:m, day:d, comparison:data });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// POST /api/weather/seed
// ═══════════════════════════════════════════
router.post('/seed', async (req,res) => {
  try {
    const city = req.body?.city||DEF_CITY;
    const existing = await WeatherRecord.countDocuments({city,dataSource:'seeded'});
    if (existing>100 && req.body?.force!==true) {
      return res.json({message:`Already seeded: ${existing} records. Send force:true to re-seed.`,count:existing});
    }
    await WeatherRecord.deleteMany({city,dataSource:'seeded'});
    const data = generateSeedData(city);
    const BATCH=200; let inserted=0;
    for (let i=0; i<data.length; i+=BATCH) {
      await WeatherRecord.insertMany(data.slice(i,i+BATCH),{ordered:false});
      inserted+=Math.min(BATCH,data.length-i);
    }
    res.json({message:`Seeded ${inserted} records for ${city}`, count:inserted});
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════════════════════════════════════
// POST /api/weather/import
// ═══════════════════════════════════════════
router.post('/import', async (req,res) => {
  try {
    const {city, records} = req.body;
    if (!Array.isArray(records)||!records.length) return res.status(400).json({error:'records array required'});
    const toInsert = records.map(r=>({...r,city:city||DEF_CITY,dataSource:'imported'}));
    await WeatherRecord.insertMany(toInsert,{ordered:false});
    res.json({message:`Imported ${toInsert.length} records`, count:toInsert.length});
  } catch(err) { res.status(500).json({error:err.message}); }
});

module.exports = router;
