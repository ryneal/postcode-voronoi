const fs = require('fs'); 
const csv = require('csv-parser');
const voronoi = require('@turf/voronoi');
const bboxPolygon = require('@turf/bbox').default;
const intersect = require('@turf/intersect').default;
const { featureCollection, point, feature } = require('@turf/helpers')
const booleanWithin = require('@turf/boolean-within').default

let inputFilePath = 'postcodes_extract.csv'
let outputFilePath = 'postcodes.geojson'
let ukGeoJsonFilePath = 'UK.geojson'
var ukFeature
let points = featureCollection([])

var argv = require('minimist')(process.argv.slice(2));

if (argv.i) inputFilePath = argv.i
if (argv.o) outputFilePath = argv.o
if (argv.g) ukGeoJsonFilePath = argv.g

try {  
    var data = fs.readFileSync(ukGeoJsonFilePath, 'utf8');
    var geojson = JSON.parse(data)
    ukFeature = geojson.features[0]
} catch(e) {
    console.log('Error:', e.stack)
}
console.log('Start processing postcode data')
fs.createReadStream(inputFilePath)
.pipe(csv(['Postcode','Latitude','Longitude']))
.on('data', function(data){
    try {
        points.features.push(point([data.Longitude, data.Latitude], { 'name': data.Postcode }))
    }
    catch(err) {
        //error handler
        console.error('Error occurred: ' + err)
    }
})
.on('end',function(){
    console.log('Processing point data into Voronoi cells')
    var options = {bbox: bboxPolygon(ukFeature)};
    var voronoiPolygons = voronoi(points, options);
    voronoiPolygons.features = voronoiPolygons.features.filter(function(el) { return el; })
    fs.writeFileSync("preprocessed.geojson", JSON.stringify(voronoiPolygons));
    console.log("Count of cells to trim: ", voronoiPolygons.features.length)
    for(i = 0; i < voronoiPolygons.features.length; i++) {
        if (!booleanWithin(voronoiPolygons.features[i], ukFeature)) {
            voronoiPolygons.features[i]  = intersect(voronoiPolygons.features[i], ukFeature)
        }
        if (i % 1000 === 0) console.log("Points processed: ", i)
    }
    voronoiPolygons.features = voronoiPolygons.features.filter(function(el) { return el; })
    console.log()
    fs.writeFileSync(outputFilePath, JSON.stringify(voronoiPolygons));
});

