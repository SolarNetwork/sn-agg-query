# SolarNetwork Aggregate Query Tool

This is a small node utility that can export SolarNetwork data as CSV,
aggregated by date. The tool will query SolarNetwork for data based
on the provided arguments, and then combine all result rows that 
occur on the same date into a single aggregate sum result for that
date.

For example, if a raw query were to return data like

```csv
created,nodeId,sourceId,wattHours
"2017-01-01 00:00:00.000Z",123,"A",1000.0
"2017-01-01 00:00:00.000Z",123,"B",555.0
```

this tool would combine those two rows because they have the same
`created` value into a single row like this:

```csv
created,nodeId,wattHours
"2017-01-01 00:00:00.000Z",123,1555.0
```

Notice the `wattHours` value is the aggregate sum of the two raw
records.

# Usage

```
Usage: node sn-agg-query.js [OPTION] [query]

Combine query results by date, adding their values together.
Alternatively, can output the raw data without aggregation.

  -r, --raw              output raw, unaggregated results
  -n, --node=ID          the node ID
  -p, --source=ID+       a source ID (can be provided more than once)
  -s, --start=DATE       the starting date, as yyyy-MM-dd HH:mm
  -e, --end=DATE         the ending date, as yyyy-MM-dd HH:mm
  -a, --aggregation=AGG  the aggregate level, e.g. Hour
  -h, --help             show this help
```

Note that multiple `source` arguments may be provided, for example

    node sn-agg-query.js --node=123 --source=A --source=B ...

# Development

This tool was created as a demonstration of using the [SolarNetwork API
Core][core] and [SolarNetwork Datum Loader][loader] packages.

 [core]: https://github.com/SolarNetwork/sn-api-core-js
 [loader]: https://github.com/SolarNetwork/sn-datum-loader-js
