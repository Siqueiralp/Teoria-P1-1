'use strict';
const { isIP } = require('node:net');
const events = new Set(['page_view', 'active_time', 'graph_play', 'graph_channel', 'graph_speed', 'graph_seek', 'solution_toggle', 'formula_open', 'goal_change']);
const slug = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value);
function validate(body) {
  if (!body || body.consent !== 'accepted-v1' || !/^[a-f0-9-]{36}$/.test(body.session || '') || !Array.isArray(body.events) || !body.events.length || body.events.length > 20) throw new Error('Invalid batch');
  return body.events.map(item => {
    if (!item || !events.has(item.type) || !slug(item.subject) || !slug(item.page) || !/^[a-f0-9-]{36}$/.test(item.id || '')) throw new Error('Invalid event');
    const result = { id: item.id, type: item.type, subject: item.subject, page: item.page };
    if (item.type === 'active_time') {
      if (!Number.isInteger(item.seconds) || item.seconds < 1 || item.seconds > 60) throw new Error('Invalid time');
      result.seconds = item.seconds;
    }
    if (['indutor', 'semicondutores', 'filtro', '0.5', '1.0', '2.0', 'play', 'pause', 'open', 'close', 'checked', 'unchecked'].includes(item.value)) result.value = item.value;
    return result;
  });
}
function clientIp(headers, header) {
  // Enable only after verifying that the hosting proxy overwrites this header.
  if (!['x-azure-clientip', 'client-ip', 'x-client-ip'].includes(header)) return null;
  let value = headers[header] || '';
  if (isIP(value)) return value;
  const bracket = value.match(/^\[([^\]]+)\]:\d+$/);
  if (bracket && isIP(bracket[1])) return bracket[1];
  value = value.replace(/:\d+$/, '');
  return isIP(value) === 4 ? value : null;
}
function device(ua) {
  ua = String(ua || '').slice(0, 512);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /(?:Chrome|CriOS)\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { browser, os, deviceClass: /Mobile|iPhone|Android/.test(ua) ? 'mobile' : 'desktop' };
}
module.exports = { validate, clientIp, device };
