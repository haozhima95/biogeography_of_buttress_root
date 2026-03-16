### This script is used for constructing Figure 3B & D

var image = ee.Image("projects/ee-haozhima95/assets/all_buttress_subsample_regression_map_20251219");

var unboundedGeo = ee.Geometry.Polygon([-180, 88, -180, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

var colors = ["FFFFD9", "EDF8B1", "C7E9B4", "7FCDBB", "41B6C4", "1D91C0", "225EA8", "253494", "081D58"]    

var vis = {min:0, max:0.3, palette:colors};

Map.addLayer(image.select([1]), vis)

var range = image.select([4]).subtract(image.select([3]));

// Set steps 
var list = [];
var lon_step = 30;
var lat_step = 0.1;


  for (var lat=-56; lat<77; lat+=lat_step) {
    list.push(ee.Feature(ee.Geometry.Polygon([-180, lat,0,lat, 180,lat,180, lat + lat_step,0,lat+lat_step,-180,lat+lat_step],null,false),{lat:lat+0.5}));
  }


var fc = ee.FeatureCollection(list);
    fc = fc.randomColumn('random',0);


var fcsample = fc.map(function(f){
  var ss = image.select([1]).reduceRegions({
    collection:f,
    reducer:ee.Reducer.mean(),
    scale:1000,
    tileScale:16,
    maxPixelsPerRegion:1e13
  });
  return ss
});

    fcsample = fcsample.flatten()
print(fcsample.limit(2))


Export.table.toDrive({
  collection:fcsample,
  description:'lat_summary_buttress_median_rf_20251224',
  fileFormat:'CSV'
});



