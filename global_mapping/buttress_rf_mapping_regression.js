### This script is used to construct Figure 3A & C

var bound = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017"),

var conti = bound.filterMetadata('wld_rgn','equals', 'SE Asia')
.merge(bound.filterMetadata('wld_rgn', 'equals', 'E Asia'))
    .merge(bound.filterMetadata('wld_rgn', 'equals', 'N Asia'))
    .merge(bound.filterMetadata('wld_rgn', 'equals', 'S Asia'))
    .merge(bound.filterMetadata('wld_rgn', 'equals', 'SW Asia'))
    .merge(bound.filterMetadata('wld_rgn', 'equals', 'Australia'))
    .merge(bound.filterMetadata('wld_rgn', 'equals', 'Oceania'));

var tridf = ee.FeatureCollection('projects/ee-haozhima95/assets/all_subsample_buttress_comp_20251219')


Map.addLayer(tridf)
print(tridf.size())

print(tridf.limit(1))

// This image composite is managed by Lidong Mo. For detail and access permission, contact lidong.mo@nankai.edu.cn.
var comp = ee.Image('users/leonidmoore/ForestBiomass/20200915_Forest_Biomass_Predictors_Image');


// Tree cover product has already been integrated into the composite. Data is from Hansen et al. 
var treecover = comp.select([58]);

var treerange = treecover.mask(treecover.gte(0.1));
    treerange = treerange.updateMask(1)

// Site water balance
var swb = ee.Image('projects/ee-haozhima95/assets/CHELSA_swb_1981-2010').rename('CHELSA_swb');

// Olsen P availability 
var olsenp = ee.Image('projects/ee-haozhima95/assets/OlsenP_mgkg-1_World_Aug2022_ver').rename('OlsenP')
// N P limitation from Du et al. 
var nplimitation = ee.Image('users/haozhima95/global_np_limitation').rename('np_limitation');

// Distance to forest edge. 
var distancecollection = ee.ImageCollection("projects/crowtherlab/t3/ForestRasterisation/2010/distanceToForestEdgeIC");
var distance = distancecollection.mosaic();
    
    
// Wind gust form ERA5

var wind = ee.Image('projects/ee-haozhima95/assets/wind_gust_max_00-24').rename('wind_gust_max');
var npp = ee.Image("projects/ee-haozhima95/assets/CHELSA_npp_1981-2010"),
    gdd10 = ee.Image("projects/ee-haozhima95/assets/CHELSA_gdd10_1981-2010");
    npp = npp.rename('CHELSA_npp');
    gdd10 = gdd10.rename('CHELSA_gdd10');
comp = comp.addBands(swb);
comp = comp.addBands(olsenp)
comp = comp.addBands(nplimitation)
comp = comp.addBands(wind);
comp = comp.addBands(npp);
comp = comp.addBands(gdd10);
comp = comp.addBands(distance);

// Mask out null value pixels
    treerange = treerange.mask(comp.select(['Nitrogen']).gte(-999));
    treerange = treerange.mask(comp.select(['OlsenP']).gte(-999));
    treerange = treerange.mask(comp.select(['CHELSA_Annual_Mean_Temperature']).gte(-999));
    treerange = treerange.mask(comp.select(['CHELSA_swb']).gte(-999));
    treerange = treerange.mask(comp.select(['PET']).gte(-999));
    treerange = treerange.mask(comp.select(['wind_gust_max']).gte(-999));


var bandtouse = [
  'CHELSA_Annual_Mean_Temperature',
  'CHELSA_Annual_Precipitation',
  'CHELSA_Precipitation_of_Driest_Month',
  'CHELSA_npp',
  'CHELSA_Temperature_Annual_Range',
  'CHELSA_swb',
  'wind_gust_max',
  'CHELSA_Min_Temperature_of_Coldest_Month',
  'CHELSA_Isothermality',
  'CHELSA_Precipitation_Seasonality',
  'EarthEnvCloudCover_MODCF_meanannual',
  'EarthEnvCloudCover_MODCF_intraannualSD',
  'EarthEnvTopoMed_Elevation',
  'EarthEnvTopoMed_Slope',
  'Nitrogen',
  'OlsenP',
  'DistanceToForestEdge',
  'EarthEnvTopoMed_Roughness',
  'CanopyHeight',
  'Fire_Frequency',
  'SG_Absolute_depth_to_bedrock',
  'SG_Sand_Content_0_100cm',
  'SG_Soil_pH_H2O_0_100cm',
  'SG_Coarse_fragments_0_100cm',
  'SG_Clay_Content_0_100cm',
  'SG_Silt_Content_0_100cm',
  'PET'
  ];
print(bandtouse)

    comp = comp.select(bandtouse)
    
var basemask = comp.mask();

var allmask = basemask.reduce(ee.Reducer.min());
Map.addLayer(allmask)
    comp = comp.updateMask(allmask)

    tridf = tridf.filter(ee.Filter.notNull(bandtouse));


// Set a loop and train each training set once by selecting the seed. 

function JSsequence(i) {
	return i ? JSsequence(i - 1).concat(i) : []
}
var numberOfSubsets = 100;
var seedlist = JSsequence(numberOfSubsets);


// Instantiate classifiers of interest according to hyperparameter dataset 
var randomForestClassifier = ee.Classifier.smileRandomForest({
	numberOfTrees: 400,
	variablesPerSplit: 2,
	minLeafPopulation:2,
	bagFraction: 0.632,
	// maxNodes:33554432,
	seed: 0
}).setOutputMode('REGRESSION');


var allcollection = seedlist.map(function(f){
  
  var subdf = tridf.filter(ee.Filter.eq('seed', f));

  var trainedclassifier = randomForestClassifier.train({
  features: subdf,
  classProperty:'meanfraction',
  inputProperties:bandtouse
});

  var predim = comp.classify(trainedclassifier);
      predim = predim.mask(treerange)
      predim = predim.updateMask(1)

});


    allcollection = ee.ImageCollection(allcollection);
    
Map.addLayer(allcollection)

var colors = ["FFFFD9", "EDF8B1", "C7E9B4", "7FCDBB", "41B6C4", "1D91C0", "225EA8", "253494", "081D58"]    

var vis = {min:0, max:0.3, palette:colors};

var meanimage = allcollection.reduce(ee.Reducer.mean()).rename('buttress_boot_mean');

var medianimage = allcollection.reduce(ee.Reducer.median()).rename('buttress_boot_mean')

var imstd = allcollection.reduce(ee.Reducer.stdDev()).toFloat().rename('buttress_boot_std');

var imlowandhigh = allcollection.reduce(ee.Reducer.percentile([2.5,97.5]));

var alltogether = meanimage.addBands(medianimage).addBands(imstd).addBands(imlowandhigh);

Map.addLayer(meanimage, vis)

var unboundedGeo = ee.Geometry.Polygon([-180, 88, -180, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

Export.image.toAsset({
   image:alltogether,
   description:'all_buttress_subsample_regression_map_20251219',
   assetId:'projects/ee-haozhima95/assets/all_buttress_subsample_regression_map_20251219',
   region: unboundedGeo,
 	crs: 'EPSG:4326',
 	crsTransform: [0.008333333333333333, 0, -180, 0, -0.008333333333333333, 90],
 	maxPixels: 1e13
});
