'use strict';

var d3 = require('d3'),
	request = require('request'),
	Getopt = require('node-getopt');

function groupResultsByDate(data) {
	return d3.nest()
		.key(function(d) { return d.created; })
		.sortKeys(d3.ascending)
		.rollup(function(group) {
			var grouped = {};
			group.forEach(function(datum) {
				var prop;
				for ( prop in datum ) {
					if ( grouped[prop] === undefined ) {
						// value doesn't exist in grouped result yet
						grouped[prop] = datum[prop];
					} else if ( prop !== 'nodeId' && typeof datum[prop] === 'number' ) {
						// add the number value to existing grouped result
						grouped[prop] += datum[prop];
					}
				}
			});
			return grouped;
		})
		.entries(data)
		.map(function(d) { return d.values; });
}

function csvColumnValue(v) {
	if ( typeof v === 'number' ) {
		return String(v);
	}
	if ( !v ) {
		return '';
	}
	return '"' + v +'"'; // NOTE: does NOT handle escaping quotes in value!
}

function printCSV(groupedData, columKeysOrder, omitHeader) {
	var columnOrder = (columKeysOrder ? columKeysOrder : []),
		seenColumns = {};
	// iterate over every grouped result, print out as "CSV"
	groupedData.forEach(function(datum, idx) {
		var prop, row = [];
		columnOrder.forEach(function(key) {
			row.push(csvColumnValue(datum[key]));
			if ( seenColumns[key] === undefined ) {
				seenColumns[key] = true;
			}
		});
		for ( prop in datum ) {
			if ( seenColumns[prop] === undefined ) {
				columnOrder.push(prop);
				seenColumns[prop] = true;
				row.push(csvColumnValue(datum[prop]));
			}
		}
		if ( idx === 0 && !omitHeader ) {
			// spit out header row
			console.log(columnOrder.join(','));
		}
		console.log(row.join(','));
	});
	return columnOrder;
}

function query(url, options) {
	var rawData = [], columnOrder = [];
	function complete() {
		var groupedData;
		if ( rawData.length < 1 ) {
			console.error('No results.');
			return;
		}

		// group all results by date
		groupedData = groupResultsByDate(rawData);
		printCSV(groupedData);
	}
	function extractOffset(data) {
		return (data.startingOffset + data.returnedResultCount < data.totalResults
				? (data.startingOffset + data.returnedResultCount)
				: 0);
	}
	function executeQuery(offset) {
		var requestUrl = url;
		if ( offset > 0 ) {
			requestUrl += '&offset=' +offset;
		}
		request({
			url: requestUrl,
			json: true
		}, function(error, response, json) {
			if ( error || response.statusCode !== 200  || json.success !== true || Array.isArray(json.data.results) === false ) {
				complete();
				return;
			}
			if ( options.raw ) {
				columnOrder = printCSV(json.data.results, columnOrder, (offset > 0));
			} else {
				Array.prototype.push.apply(rawData, json.data.results);
			}
			offset = extractOffset(json.data);
			if ( offset > 0 ) {
				console.error('Loading data at offset %d...', offset);
				executeQuery(offset);
			} else if ( !options.raw ) {
				complete();
			}
		});
	}

	if ( options.raw ) {
		console.error('Saving raw data.');
	}

	executeQuery();
}

var getopt = new Getopt([
		['r', 'raw', 'output raw, unaggregated results'],
		['h', 'help', 'show this help']
	]).bindHelp(
	  "Usage: node sn-agg-query.js [OPTION] url\n" +
	  "\n" +
	  "Combine query results by date, adding their values together.\n" +
	  "Alternatively, can output the raw data without aggregation.\n" +
	  "\n" +
	  "[[OPTIONS]]\n"
	);

var options = getopt.parseSystem();

if ( !options.argv.length ) {
	getopt.showHelp();
	return;
}

query(options.argv[0], options.options);
