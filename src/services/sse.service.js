const EventEmitter = require("events");

const sseEmitter = new EventEmitter();

sseEmitter.setMaxListeners(0);

module.exports = sseEmitter;
