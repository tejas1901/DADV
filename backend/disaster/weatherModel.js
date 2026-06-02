// ============================================================
// disaster/weatherModel.js — Mongoose Schemas
// ============================================================
const mongoose = require('mongoose');

// ── Historical & Live Weather Record ──────────────────────────
const weatherRecordSchema = new mongoose.Schema({
  date:          { type: Date,   required: true, index: true },
  city:          { type: String, default: 'Chennai', index: true },
  country:       { type: String, default: 'IN' },
  temperature:   { type: Number },   // °C
  feelsLike:     { type: Number },   // °C
  tempMax:       { type: Number },   // °C
  tempMin:       { type: Number },   // °C
  humidity:      { type: Number },   // %
  rainfall:      { type: Number, default: 0 }, // mm
  windSpeed:     { type: Number },   // km/h
  windDirection: { type: Number },   // degrees 0-360
  pressure:      { type: Number },   // hPa
  cloudCoverage: { type: Number },   // %
  uvIndex:       { type: Number },
  visibility:    { type: Number },   // km
  condition:     { type: String },   // e.g. 'Heavy Rain', 'Clear'
  conditionCode: { type: Number },   // OpenWeatherMap code
  dataSource:    { type: String, enum: ['live','historical','seeded','imported'], default: 'seeded' },
}, { timestamps: true });

weatherRecordSchema.index({ date: 1, city: 1 }, { unique: true });

// ── Disaster Risk Sub-Schema ───────────────────────────────────
const disasterRiskSchema = new mongoose.Schema({
  floodRisk:     { type: String, enum: ['Low','Moderate','High','Extreme'], default: 'Low' },
  cycloneAlert:  { type: String, enum: ['None','Watch','Warning','Extreme'], default: 'None' },
  heatwave:      { type: String, enum: ['None','Moderate','Severe','Extreme'], default: 'None' },
  landslide:     { type: String, enum: ['Low','Moderate','High','Extreme'], default: 'Low' },
  droughtWarning:{ type: String, enum: ['None','Mild','Moderate','Severe'], default: 'None' },
  overallLevel:  { type: String, enum: ['Low','Moderate','High','Extreme'], default: 'Low' },
  overallScore:  { type: Number, default: 0 }, // 0-100
}, { _id: false });

// ── Per-Day Prediction Sub-Schema ─────────────────────────────
const predictionDaySchema = new mongoose.Schema({
  date:                { type: Date, required: true },
  dayOfWeek:           { type: String },
  day:                 { type: Number },
  month:               { type: Number },
  monthName:           { type: String },
  year:                { type: Number },
  predictedTemp:       { type: Number },  // °C
  predictedTempMax:    { type: Number },
  predictedTempMin:    { type: Number },
  rainfallProbability: { type: Number },  // %
  predictedRainfall:   { type: Number },  // mm
  humidity:            { type: Number },  // %
  cloudCondition:      { type: String },
  cloudCoverage:       { type: Number },  // %
  windSpeed:           { type: Number },  // km/h
  pressure:            { type: Number },  // hPa
  condition:           { type: String },
  disasterRisk:        { type: disasterRiskSchema },
}, { _id: false });

// ── 90-Day Forecast Document ───────────────────────────────────
const weatherPredictionSchema = new mongoose.Schema({
  city:              { type: String, default: 'Chennai', index: true },
  generatedAt:       { type: Date, default: Date.now },
  forecastStartDate: { type: Date },
  forecastEndDate:   { type: Date },
  predictions:       [predictionDaySchema],
  modelInfo: {
    algorithm:      { type: String, default: 'Weighted Ensemble (ES + Seasonal + LR)' },
    accuracy:       { type: Number },
    dataPointsUsed: { type: Number },
  },
}, { timestamps: true });

const WeatherRecord    = mongoose.model('WeatherRecord',    weatherRecordSchema);
const WeatherPrediction = mongoose.model('WeatherPrediction', weatherPredictionSchema);

module.exports = { WeatherRecord, WeatherPrediction };
