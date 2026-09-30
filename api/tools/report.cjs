// Run privately with ANALYTICS_STORAGE_CONNECTION in the environment.
'use strict';
const { TableClient } = require('@azure/data-tables');
(async () => {
  const table = TableClient.fromConnectionString(process.env.ANALYTICS_STORAGE_CONNECTION, process.env.ANALYTICS_TABLE || 'StudyEvents');
  const days = Number(process.argv[2] || 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Use 1 to 365 days');
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const pages = {}, browsers = {}, systems = {}, sessions = new Set();
  let count = 0;
  for await (const event of table.listEntities({ queryOptions: { filter: "PartitionKey ge '" + since + "'" } })) {
    count++; sessions.add(event.session);
    const key = event.subject + '/' + event.page;
    const page = pages[key] ||= { views: 0, activeSeconds: 0, graphActions: 0, solutions: 0 };
    if (event.type === 'page_view') {
      page.views++;
      browsers[event.browser] = (browsers[event.browser] || 0) + 1;
      systems[event.os] = (systems[event.os] || 0) + 1;
    }
    if (event.type === 'active_time') page.activeSeconds += event.seconds;
    if (event.type.startsWith('graph_')) page.graphActions++;
    if (event.type === 'solution_toggle' && event.value === 'open') page.solutions++;
  }
  console.log(JSON.stringify({ since, events: count, tabSessions: sessions.size, pages, browsers, systems }, null, 2));
})().catch(() => { console.error('Unable to read analytics. Check private backend configuration.'); process.exitCode = 1; });
