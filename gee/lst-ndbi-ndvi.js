var table = Table projects/uhi-mapping-505205/assets/2011_Dist


// AOI — All Delhi Districts
var delhi = ee.FeatureCollection(table)
  .filter(ee.Filter.eq('ST_NM', 'NCT of Delhi'));
var aoi = delhi.geometry();

// Helper Function — Build Annual Composite
// Takes a year and returns LST, NDVI, NDBI for that year's April-June window

function buildAnnualComposite(year) {
  var startDate = ee.Date.fromYMD(year, 4, 1);
  var endDate = ee.Date.fromYMD(year, 6, 15);

  // Sentinel-2 composite for NDVI and NDBI
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
    .median()
    .clip(aoi);

  // Landsat 8 composite for LST
  var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 10))
    .median()
    .clip(aoi);

  // LST — convert thermal band to Celsius using USGS scaling formula
  var lst = landsat.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename('LST');

  // NDVI — vegetation density using NIR and Red bands
  var ndvi = s2.normalizedDifference(['B8', 'B4'])
    .rename('NDVI');

  // NDBI — built-up density using SWIR and NIR bands
  var ndbi = s2.normalizedDifference(['B11', 'B8'])
    .rename('NDBI');

  // Return all 3 as a single multi-band image tagged with the year
  return lst.addBands(ndvi).addBands(ndbi)
    .set('year', year);
}

// Build Composites for All Years
// 2020/2021 included but flagged as COVID anomaly years
// LST in those years likely underestimates true urban heat due to reduced traffic and industrial activity

var years = [2019, 2020, 2021, 2022, 2023, 2024];

// Map the helper function over each year
// Result is an ImageCollection with one composite per year
var annualComposites = ee.ImageCollection(
  years.map(function(year) {
    return buildAnnualComposite(year);
  })
);

print('Annual composites:', annualComposites);

// Extract Individual Year Composites
// For change detection and export

var composite2019 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2019)).first());
var composite2020 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2020)).first());
var composite2021 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2021)).first());
var composite2022 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2022)).first());
var composite2023 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2023)).first());
var composite2024 = ee.Image(annualComposites.filter(ee.Filter.eq('year', 2024)).first());

// 6-Year Median Baseline
// Useful for hotspot scoring in Python later

var medianComposite = annualComposites.median().clip(aoi);
var lstMedian = medianComposite.select('LST').rename('LST_median');
var ndviMedian = medianComposite.select('NDVI').rename('NDVI_median');
var ndbiMedian = medianComposite.select('NDBI').rename('NDBI_median');


// Change Detection — 2024 minus 2019

var lstChange = composite2024.select('LST')
  .subtract(composite2019.select('LST'))
  .rename('LST_change');

var ndviChange = composite2024.select('NDVI')
  .subtract(composite2019.select('NDVI'))
  .rename('NDVI_change');

var ndbiChange = composite2024.select('NDBI')
  .subtract(composite2019.select('NDBI'))
  .rename('NDBI_change');

// Visualize Key Layers

Map.centerObject(delhi, 11);
Map.addLayer(delhi, {color: 'blue'}, 'Delhi Districts');

// 2024 LST — current heat snapshot
var lstStats2024 = composite2024.select('LST').reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: aoi,
  scale: 30,
  maxPixels: 1e9
});
Map.addLayer(composite2024.select('LST'), {
  min: ee.Number(lstStats2024.get('LST_min')).getInfo(),
  max: ee.Number(lstStats2024.get('LST_max')).getInfo(),
  palette: ['blue', 'yellow', 'orange', 'red']
}, 'LST 2024');

// LST Change — how much hotter since 2019
// red = got hotter, blue = got cooler
var lstChangeStats = lstChange.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: aoi,
  scale: 30,
  maxPixels: 1e9
});
Map.addLayer(lstChange, {
  min: ee.Number(lstChangeStats.get('LST_change_min')).getInfo(),
  max: ee.Number(lstChangeStats.get('LST_change_max')).getInfo(),
  palette: ['blue', 'white', 'red']
}, 'LST Change 2019-2024');

// NDVI Change — where vegetation was lost or gained
// red = vegetation lost, green = vegetation gained
var ndviChangeStats = ndviChange.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e9
});
Map.addLayer(ndviChange, {
  min:  ee.Number(ndviChangeStats.get('NDVI_change_min')).getInfo(),
  max: ee.Number(ndviChangeStats.get('NDVI_change_max')).getInfo(),
  palette: ['red', 'white', 'green']
}, 'NDVI Change 2019-2024');

// Print Range Checks for All Key Outputs

print('LST 2024 range:', lstStats2024);
print('LST Change range:', lstChangeStats);
print('NDVI Change range:', ndviChangeStats);
print('6-year median LST range:', lstMedian.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: aoi,
  scale: 30,
  maxPixels: 1e9
}));


// Export All 21 Rasters to Google Cloud Storage

var bucket = 'YOUR-BUCKET-NAME'; // replace with your GCS bucket name

// Helper function to export a single band image

function exportToBucket(image, description, prefix, scaleVal) {
  Export.image.toCloudStorage({
    image: image,
    description: description,
    bucket: bucket,
    fileNamePrefix: 'UHI_Delhi/' + prefix,
    region: aoi,
    scale: scaleVal,
    crs: 'EPSG:4326',
    maxPixels: 1e9
  });
}

// Export yearly LST rasters (30m — Landsat resolution)
exportToBucket(composite2019.select('LST'), 'LST_2019', 'LST_2019', 30);
exportToBucket(composite2020.select('LST'), 'LST_2020', 'LST_2020', 30);
exportToBucket(composite2021.select('LST'), 'LST_2021', 'LST_2021', 30);
exportToBucket(composite2022.select('LST'), 'LST_2022', 'LST_2022', 30);
exportToBucket(composite2023.select('LST'), 'LST_2023', 'LST_2023', 30);
exportToBucket(composite2024.select('LST'), 'LST_2024', 'LST_2024', 30);

// Export yearly NDVI rasters (10m — Sentinel-2 resolution)
exportToBucket(composite2019.select('NDVI'), 'NDVI_2019', 'NDVI_2019', 10);
exportToBucket(composite2020.select('NDVI'), 'NDVI_2020', 'NDVI_2020', 10);
exportToBucket(composite2021.select('NDVI'), 'NDVI_2021', 'NDVI_2021', 10);
exportToBucket(composite2022.select('NDVI'), 'NDVI_2022', 'NDVI_2022', 10);
exportToBucket(composite2023.select('NDVI'), 'NDVI_2023', 'NDVI_2023', 10);
exportToBucket(composite2024.select('NDVI'), 'NDVI_2024', 'NDVI_2024', 10);

// Export yearly NDBI rasters (10m — Sentinel-2 resolution)
exportToBucket(composite2019.select('NDBI'), 'NDBI_2019', 'NDBI_2019', 10);
exportToBucket(composite2020.select('NDBI'), 'NDBI_2020', 'NDBI_2020', 10);
exportToBucket(composite2021.select('NDBI'), 'NDBI_2021', 'NDBI_2021', 10);
exportToBucket(composite2022.select('NDBI'), 'NDBI_2022', 'NDBI_2022', 10);
exportToBucket(composite2023.select('NDBI'), 'NDBI_2023', 'NDBI_2023', 10);
exportToBucket(composite2024.select('NDBI'), 'NDBI_2024', 'NDBI_2024', 10);

// Export 6-year median baselines (used for hotspot scoring in Python)
exportToBucket(lstMedian, 'LST_median_2019_2024', 'LST_median', 30);
exportToBucket(ndviMedian, 'NDVI_median_2019_2024', 'NDVI_median', 10);
exportToBucket(ndbiMedian, 'NDBI_median_2019_2024', 'NDBI_median', 10);

// Export change detection rasters
exportToBucket(lstChange, 'LST_change_2019_2024', 'LST_change', 30);
exportToBucket(ndviChange, 'NDVI_change_2019_2024', 'NDVI_change', 10);
exportToBucket(ndbiChange, 'NDBI_change_2019_2024', 'NDBI_change', 10);
