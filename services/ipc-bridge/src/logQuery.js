function buildLogPage(history, { limit = 50, offset = 0, state, source, since }) {
  let filtered = history.slice();
  if (state) {
    filtered = filtered.filter((entry) => entry.state === state);
  }
  if (source) {
    filtered = filtered.filter((entry) => entry.source === source);
  }
  if (since) {
    const sinceTime = Date.parse(since);
    if (!Number.isNaN(sinceTime)) {
      filtered = filtered.filter((entry) => {
        const timestamp = Date.parse(entry.timestamp || entry.receivedAt);
        return !Number.isNaN(timestamp) && timestamp >= sinceTime;
      });
    }
  }

  const total = filtered.length;
  const end = Math.max(0, total - offset);
  const start = Math.max(0, end - limit);
  const page = filtered.slice(start, end);

  return {
    entries: page,
    total,
    limit,
    offset
  };
}

module.exports = { buildLogPage };
