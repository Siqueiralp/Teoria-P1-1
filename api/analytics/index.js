'use strict';
const { validate, clientIp, device } = require('./validate');
module.exports = async function (context, req) {
  const env = process.env;
  const respond = (status, body) => { context.res = { status, headers: { 'Cache-Control': 'no-store' }, body }; };
  if (env.ANALYTICS_ENABLED !== 'true' || !env.HIVEMQ_HOST || !env.HIVEMQ_USERNAME || !env.HIVEMQ_PASSWORD || !env.ANALYTICS_STORAGE_CONNECTION || !env.ANALYTICS_ALLOWED_ORIGIN) return respond(503, { error: 'Analytics unavailable' });
  if (req.headers.origin !== env.ANALYTICS_ALLOWED_ORIGIN || !String(req.headers['content-type'] || '').startsWith('application/json')) return respond(403, { error: 'Forbidden' });
  if (Number(req.headers['content-length']) > 16384 || JSON.stringify(req.body || {}).length > 16384) return respond(413, { error: 'Batch too large' });
  let batch;
  try { batch = validate(req.body); } catch (_) { return respond(400, { error: 'Invalid batch' }); }
  const { TableClient } = require('@azure/data-tables');
  const mqtt = require('mqtt');
  const now = new Date().toISOString();
  const table = TableClient.fromConnectionString(env.ANALYTICS_STORAGE_CONNECTION, env.ANALYTICS_TABLE || 'StudyEvents', { retryOptions: { maxRetries: 1, tryTimeoutInMs: 4000 } });
  const metadata = { ...device(req.headers['user-agent']),
    language: /^[a-zA-Z-]{2,20}$/.test(req.body.language || '') ? req.body.language : 'unknown',
    viewport: ['small', 'medium', 'large'].includes(req.body.viewport) ? req.body.viewport : 'unknown' };
  const ip = clientIp(req.headers, env.ANALYTICS_TRUSTED_IP_HEADER);
  let connection;
  try {
    // Store first: a broker outage must not erase the engagement history.
    for (const event of batch) {
      await table.upsertEntity({ partitionKey: now.slice(0, 10), rowKey: event.id, ...event, session: req.body.session, receivedAt: now, ...metadata, ...(ip ? { ip } : {}) }, 'Replace');
    }
    connection = await mqtt.connectAsync('mqtts://' + env.HIVEMQ_HOST + ':8883', {
      username: env.HIVEMQ_USERNAME, password: env.HIVEMQ_PASSWORD,
      connectTimeout: 4000, reconnectPeriod: 0, clean: true, protocolVersion: 5
    });
    let deadline;
    try {
      await Promise.race([
        connection.publishAsync('study-guide/engagement/v1', JSON.stringify({ schema: 1, session: req.body.session, receivedAt: now, ...metadata, ...(ip ? { ip } : {}), events: batch }), { qos: 1, retain: false, properties: { messageExpiryInterval: 86400 } }),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Publish timeout')), 4000); })
      ]);
    } finally { clearTimeout(deadline); }
    respond(202, { stored: true, published: true });
  } catch (_) {
    // Never log payloads, IPs, secrets or broker URLs.
    context.log.warn('Analytics delivery failed');
    respond(503, { error: 'Delivery unavailable' });
  } finally {
    if (connection) await connection.endAsync(true);
  }
};
