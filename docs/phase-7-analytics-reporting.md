# Phase 7: Analytics and Reporting

## Goal

Deliver reliable internal analytics for push performance, subscriber growth, and operational decision-making.

## Scope

* Event-based analytics for sent, delivered, clicked, failed, and expired notifications
* Main analytics dashboard with date-range filtering
* Country-based analytics
* Site-based analytics
* Individual push performance reports
* Time performance analytics
* Content performance analytics
* Subscriber growth analytics
* Exportable reports in CSV, Excel, and PDF formats

## Reporting Model

Analytics must be derived from immutable event records. Aggregated numbers may be cached for presentation, but they are not the source of truth.

## Required Dashboard Views

* Overall performance
* Country performance
* Site performance
* Individual push performance
* Time-of-day performance
* Content-type performance
* Growth trends

## Filtering

Required date-range presets:

* Today
* Last 7 days
* Last 30 days
* Last 90 days
* Last 1 year
* Custom date range

## Export Formats

* CSV
* Excel
* PDF

## Notes

* Best-performing metrics should be defined from the highest CTR or delivery rate within the selected window, depending on the chart.
* Country, site, time-performance, and content-performance reports are implemented.
* The dashboard reporting surface includes a compact custom range picker, comparison mode, site scoping, and drilldown tabs for the major report types.
* Content analytics use a stable content taxonomy so reporting stays consistent.
* Campaign content type seeds a default UTM template for the notification URL, with controlled overrides allowed in the campaign editor.
* CSV, Excel, and PDF export are available for the current analytics reports.
* Export features must preserve the active site and date filters.
