const ee = require('@google/earthengine');

// function to find today DOY
// uses Date of the machine it is running on
exports.getDOY = function() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  var oneDay = 1000 * 60 * 60 * 24;
  var day = Math.floor(diff / oneDay);
  return day;
}

// find the most recent completed 16-day period
exports.getPeriod = function(day, year) {
  // define list of DOYs representing the start of 16-day periods
  var doys = [1, 17, 33, 49, 65, 81, 97, 113, 129, 145, 161, 177, 193, 
            209, 225, 241, 257, 273, 289, 305, 321, 337, 353];

  // on day 5 of the current, composite day 353 of the previous year
  if (day == 5 && year != new Date().getFullYear()) {
    return [353, 365];
  } else if (year == new Date().getFullYear()) {
    for (var i = 0; i < doys.length; i++) {
      if (day == doys[i] + 3) {
        return doys.slice(i-1, i+1); 
      } 
    }
  }
}


// Landsat functions
// bilinear resampling
var bilinear = function (image) {
  return image.resample('bilinear')
    .copyProperties(image, ['system:time_start']);
}

// calculate NDVI
var ndviRT = function(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4'])
    .rename('ndvi');
  
  return ndvi
    .copyProperties(image, ['system:time_start']);
}

// mask pixels
// Fill, Dilated Cloud, Cirrus, Cloud, Cloud Shadow
var landsatMask = function(image) {
  var qaMask = image
    .select(['QA_PIXEL'])
    .bitwiseAnd(parseInt('11111', 2))
    .eq(0);
  var qualityRadSat = image.select(['QA_RADSAT']);
  var saturatedMask = qualityRadSat
    .bitwiseAnd(8).eq(0)  // Band 4 not saturated
    .and(qualityRadSat.bitwiseAnd(16).eq(0)); // Band 5 not saturated

  var opticalBands = image.select(['B5', 'B4']);
  opticalBands = opticalBands
    .updateMask(qaMask)
    .updateMask(saturatedMask);

  return opticalBands
    .updateMask(opticalBands.mask().reduce(ee.Reducer.min())) // mask if any band is masked
    .copyProperties(image, ['system:index', 'system:time_start']);
}


// make NDVI composite
exports.ndviComposite = function(region, year, doy) {
  
  // Landsat 8 and 9 real time collections
  var landsat9RT = ee.ImageCollection("LANDSAT/LC09/C02/T1_TOA")
        .filter(ee.Filter.eq('PROCESSING_LEVEL','L1TP'))
        .filter(ee.Filter.gt('SUN_ELEVATION', 0)),
      landsat8RT = ee.ImageCollection("LANDSAT/LC08/C02/T1_RT_TOA")
        .filter(ee.Filter.eq('PROCESSING_LEVEL','L1TP'))
        .filter(ee.Filter.gt('SUN_ELEVATION', 0));
  
  // merge collections
  var landsat = landsat9RT.merge(landsat8RT);
  
  // define 16-day period of interest and dates
  var startDate = ee.Date.parse('YYYYDDD', year.toString() + doy.toString());
  var endDate = startDate.advance(16, 'day');
  
  var ndvi = landsat
    .filter(ee.Filter.bounds(region.geometry().bounds()))
    .filter(ee.Filter.date(startDate, endDate))
    .map(bilinear)
    .map(landsatMask)
    .map(ndviRT)
    .mean()
    .multiply(100) // scale NDVI value by 100
    .int8()
    .set('system:time_start', startDate.millis());
    
  return ndvi;
}
