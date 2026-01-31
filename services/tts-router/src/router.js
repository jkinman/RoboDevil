function chooseProvider(input) {
  const {
    length = 0,
    priority = "normal",
    demonicIntensity = "med",
    networkOnline = true
  } = input || {};

  if (!networkOnline) {
    return { provider: "local", reason: "offline" };
  }

  if (length > 500) {
    return { provider: "local", reason: "long_response" };
  }

  if (priority === "urgent" || demonicIntensity === "high") {
    return { provider: "inworld", reason: "high_impact" };
  }

  if (length < 200) {
    return { provider: "inworld", reason: "short_reply" };
  }

  return { provider: "local", reason: "default_local" };
}

module.exports = { chooseProvider };
