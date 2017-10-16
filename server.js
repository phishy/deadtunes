var express = require('express');
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var db;

// // Connect to database and set var db
MongoClient.connect("mongodb://nth-chile:yerbamate1@ds115045.mlab.com:15045/grateful-dead", function(err, database) {
	if (err) console.error(err);
	else db = database;
});



// Set Handlebars view engine
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Set static path
app.use(express.static(path.join(__dirname, 'public')));

// REST API
app.get('/api', function (req, res) {
	getYears(res);
});
app.get('/api/:year([0-9]{4})', function (req, res) {
	let year = req.params.year;
	getMonths(res, year);
});
app.get('/api/:year([0-9]{4})-:show([0-9]{2}-[0-9]{2})', function (req, res) {
	let year = req.params.year;
	let show = req.params.show;
	getTracks(res, year, show);
});
app.get('*', function(req, res) {
	res.render('index');
});


app.listen(3000, function() {
	console.log('Server started on port 3000.');
});


// FUNCTIONS
function getYears(res) {
	db.collection('sources').aggregate([
		{
			"$project": {
				"year": {"$year": "$date"}
			}
		},
		{
			"$group": {
				"_id": null,
				"distinctDate": {
					"$addToSet": {"year": "$year"}
				}
			}
		}
	], function(err, result) {
		if (err) console.error(err);
		else {
			let listItems = {type: 'years', results: []};
			result[0]['distinctDate']
				.sort(function(a, b) {
			  	return b.year - a.year;
				})
				.forEach(function(year) {
					listItems.results.push({
						href: '\#\/' + year['year'],
						text: year['year']
					});
				});
			res.send(listItems);
		}
	});
}

function getMonths(res, year) {
	db.collection('sources').aggregate([
		{
			"$project": {
				"venue": 1,
				"day": {"$dayOfMonth": "$date"},
				"month": {"$month": "$date"},
				"year": {"$year": "$date" }
			}
		},
		{
			"$match": {
				'year': parseFloat(year)
			}
		},
		{
			"$group": {
				"_id": {"month": "$month", "day": "$day"},
				"venue": {"$first": "$venue"},
				"count": {"$sum": 1 }
			}
		}
	], function(err, result) {
		if (err) console.error(err);
		else {
			let listItems = {type: 'shows', results: []};
			result
			.sort(function(a, b) {
			  return ("" + a._id.month + a._id.day) - ("" + b._id.month + b._id.day);
			})
			.forEach(function(show) {
				if(show._id.month.toString().length == 1) {
					show._id.month = "0" + show._id.month;
				}
				if(show._id.day.toString().length == 1) {
					show._id.day = "0" + show._id.day;
				}
				listItems.results.push({
					href: `\#\/${year}-${show._id.month}-${show._id.day}`,
					text: `${show._id.month}.${show._id.day} - ${show.venue}` 
				})
			});
			res.send(listItems);
		}
	});
}
function getTracks(res, year, show) {
	db.collection('sources').aggregate([
		{
			"$match": {
				"date": new Date(`<${year}-${show}>`)
			}
		}
	], function(err, result) {
		if (err) console.error(err);
		else {
			let data = {type: 'sources', results: []};
			result
			.forEach(function(source) {
				let array = [];
				data.date = {
					year: source.date.getFullYear(),
					month: source.date.getMonth() + 1,
					day: source.date.getDate(),
				};
				data.subject = source.subject;
				data.venue = source.venue;
				data.sourceTitle = source.title;
				source.tracks.sort(function(a, b) {
					return a.track - b.track;
				})
				.forEach(function(track, i) {
					array.push({
						data_src: 'http://archive.org/download' + source.dir.replace(/\/\d+\/items/, '') + '/' + track.uri,
						duration: track.duration,
						href: `\#\/${year}-${show}\/` + String(track.title).replace(/\s/g, '_').replace(/\'/, ''),
						title: track.title,
						track: track.track
					})
				})
				data.results.push(array);
			});
			res.send(data);
		}
	});
}