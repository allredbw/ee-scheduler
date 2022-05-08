const ee = require('@google/earthengine');
const helpers = require('./helpers');

var eeKey = require('./eeKey.json');

exports.ndvi = function (message, context) {

  var year = 2022;
  var todayDOY = helpers.getDOY();
  var doyPeriods = helpers.getPeriod(todayDOY, year);
  
  if (doyPeriods === undefined || doyPeriods.length == 0) {
    console.info('no exports');
    return null;
  } else {
    
      var doyPeriodStart = doyPeriods[0];
      var doyPeriodEnd = doyPeriods[1];

      // log some dates
      console.info('today DOY:', todayDOY);
      console.info('16-day periods:', doyPeriods);
      console.info('year:', year);
      
      ee.data.authenticateViaPrivateKey(eeKey, () => {
        ee.initialize(null, null, () => {
              
        // define the state of Texas
        var state = ee.FeatureCollection("TIGER/2018/States")
          .filter(ee.Filter.eq('NAME', 'Texas'));
        
        // create NDVI composite
        var stateNDVI = helpers.ndviComposite(state, year, doyPeriodStart)
          .clipToCollection(state);
        
        // create task id
        var newTaskId = ee.data.newTaskId(1)[0];
        
        // define export parameters
        params = {
          element: stateNDVI,
          type: 'EXPORT_IMAGE',
          description: 'ndvi-' + year + ('00' + doyPeriodStart).slice(-3),
          crs: 'EPSG:4326',
          scale: 960,
          region: state.geometry().bounds(),
          maxPixels: 1e12,
          assetId: 'projects/[PROJECT]/ndvi-' + year.toString() + doyPeriod.toString(),
          pyramidingPolicy: 'MEAN',
        }
          
        // start export
        ee.data.startProcessing(newTaskId, params, function(result) {
          console.info('task:', result.taskId);
        });      
      });
    });
  }
}
