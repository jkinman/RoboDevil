function estimatePlaybackMs(text = "") {
  const charsPerSecond = 15;
  const minMs = 1000;
  const estimate = Math.ceil((text.length / charsPerSecond) * 1000);
  return Math.max(minMs, estimate);
}

module.exports = { estimatePlaybackMs };
