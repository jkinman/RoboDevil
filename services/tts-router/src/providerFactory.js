const inworld = require("./providers/inworld");
const piper = require("./providers/piper");

function getProvider(name) {
  switch (name) {
    case "inworld":
      return inworld;
    case "local":
      return piper;
    default:
      return null;
  }
}

module.exports = { getProvider };
