const sseEmitter = require("../services/sse.service");

const streamTransactions = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write(":connected\n\n");

  const onTransaction = (transaction) => {
    const data = JSON.stringify(transaction);
    res.write(`event: new-transaction\n`);
    res.write(`data: ${data}\n\n`);
  };

  sseEmitter.on("new-transaction", onTransaction);

  req.on("close", () => {
    sseEmitter.off("new-transaction", onTransaction);
  });
};

module.exports = {
  streamTransactions,
};
