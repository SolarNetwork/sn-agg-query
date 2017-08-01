'use strict';

var DatumLoader = require('solarnetwork-datum-loader').DatumLoader,
	d3array = require('d3-array'),
	d3collection = require('d3-collection'),
	sn = require('solarnetwork-api-core'),
	Getopt = require('node-getopt');

function groupResultsByDate(data) {
	return d3collection.nest()
		.key(function(d) { return d.created; })
		.sortKeys(d3array.ascending)
		.rollup(function(group) {
			var grouped = {},
				ignore = {};
			group.forEach(function(datum) {
				var prop;
				for ( prop in datum ) {
					if ( grouped[prop] === undefined ) {
						// value doesn't exist in grouped result yet
						if ( ignore[prop] === undefined ) {
							grouped[prop] = datum[prop];
						}
					} else if ( prop !== 'nodeId' && typeof datum[prop] === 'number' ) {
						// add the number value to existing grouped result
						grouped[prop] += datum[prop];
					} else if ( grouped[prop] !== datum[prop] ) {
						// data value changed, remove from aggregate and ignore
						ignore[prop] = true;
						delete grouped[prop];
					}
				}
			});
			return grouped;
		})
		.entries(data)
		.map(function(d) {
			return d.value;
		});
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

function query(query, options) {
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

	var urlHelper = new sn.NodeDatumUrlHelper();
	urlHelper.publicQuery = true;

	var filter = new sn.DatumFilter(sn.urlQuery.urlQueryParse(query));
	if ( options.node ) {
		filter.nodeId = options.node;
	}
	if ( options.source ) {
		filter.sourceIds = options.source;
	}
	if ( options.start ) {
		filter.startDate = sn.dateParser(options.start);
	}
	if ( options.end ) {
		filter.endDate = sn.dateParser(options.end);
	}
	if ( options.aggregation ) {
		filter.aggregation = sn.Aggregation.valueOf(options.aggregation);
	}
	var loader = new DatumLoader(urlHelper, filter).incremental(true);
	
	var promise = new Promise(function(resolve, reject) {
		if ( options.raw ) {
			console.error('Saving raw data.');
		}
		loader.load(function(error, data, done, page) {
			if ( error ) {
				console.error(error);
				reject(error);
				return;
			}
			var offset = (page ? page.offset : 0);
			if ( options.raw ) {
				columnOrder = printCSV(data, columnOrder, (offset > 0));
			} else {
				Array.prototype.push.apply(rawData, data);
			}
			if ( offset > 0 ) {
				console.error('Loaded data at offset %d...', offset);
			}
			if ( done ) {
				if ( !options.raw ) {
					complete();
				}
				resolve(rawData);
			}
		});
	});

	Promise.all(promise);
}

var getopt = new Getopt([
		['r', 'raw', 'output raw, unaggregated results'],
		['n', 'node=ID', 'the node ID'],
		['p', 'source=ID+', 'a source ID (can be provided more than once)'],
		['s', 'start=DATE', 'the starting date, as yyyy-MM-dd HH:mm'],
		['e', 'end=DATE', 'the ending date, as yyyy-MM-dd HH:mm'],
		['a', 'aggregation=AGG', 'the aggregate level, e.g. Hour'],
		['h', 'help', 'show this help']
	]).bindHelp(
	  "Usage: node sn-agg-query.js [OPTION] query\n" +
	  "\n" +
	  "Combine query results by date, adding their values together.\n" +
	  "Alternatively, can output the raw data without aggregation.\n" +
	  "\n" +
	  "[[OPTIONS]]\n"
	);

var options = getopt.parseSystem();

query(options.argv[0], options.options);

