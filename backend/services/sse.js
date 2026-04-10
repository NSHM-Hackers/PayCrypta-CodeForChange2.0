// SSE Clients map to store connections for update events
export const sseClients = new Map();

export const sseRoute = async (req, res) => {
  const userId = req.user.id;

  // Set headers for Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  // Tell EventSource how long to wait before reconnecting.
  res.write("retry: 3000\n\n");
  res.write(
    `event: connected\ndata: ${JSON.stringify({ connected: true, userId })}\n\n`,
  );

  // Store this connection
  sseClients.set(userId, res);
  console.log(`SSE client connected for user: ${userId}`);

  // Keep connection alive with periodic heartbeat
  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30000); // Every 30 seconds

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(userId);
    console.log(`SSE client disconnected for user: ${userId}`);
  });
};

// Function to send updates to a specific user
export const sendSSEUpdate = (userId, data, eventName = "update") => {
  const userConnection = sseClients.get(userId);
  if (userConnection && !userConnection.writableEnded) {
    userConnection.write(
      `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`,
    );
  } else {
    sseClients.delete(userId);
  }
};
