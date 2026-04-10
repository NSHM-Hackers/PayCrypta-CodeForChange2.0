import { WebSocketServer } from "ws";
import { getAllExchangeRates } from "./exchangeRate.js";

const BASE_CURRENCY = "INR";
const BROADCAST_INTERVAL = 10 * 1000; // 10 seconds in milliseconds

// Cache configuration
let rateCache = null;

// Initialize WebSocket Server
export function initializeWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: "/exchange-rates" });

  // Handle new connections
  wss.on("connection", (ws) => {
    console.log("[WSS] Client connected");
    ws.currentCurrency = null;
    ws.isAlive = true;

    // Handle incoming messages
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "SUBSCRIBE") {
          ws.currentCurrency = data.currency;
          console.log(`[WSS] Client subscribed to: ${data.currency}`);

          // Send cached data immediately if available
          if (rateCache) {
            const rate = rateCache[data.currency];
            if (rate) {
              ws.send(
                JSON.stringify({
                  type: "RATE_UPDATE",
                  currency: data.currency,
                  rate: rate,
                  baseCurrency: BASE_CURRENCY,
                  timestamp: Date.now(),
                }),
              );
            }
          }
        }
      } catch (error) {
        console.error("[WSS] Invalid message format:", error.message);
      }
    });

    // Handle pong response
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Handle client disconnect
    ws.on("close", () => {
      console.log("[WSS] Client disconnected");
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error("[WSS] WebSocket error:", error.message);
    });
  });

  // Heartbeat interval - remove dead connections
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Every 30 seconds

  // Broadcast loop - send rates every 10 seconds
  setInterval(async () => {
    // Only bother refreshing if we have connected clients
    if (wss.clients.size > 0) {
      try {
        rateCache = await getAllExchangeRates();
      } catch (error) {
        console.error("[WSS] Failed to fetch rates:", error.message);
      }

      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.currentCurrency) {
          // readyState 1 is OPEN
          const rate = rateCache?.[client.currentCurrency];

          if (rate) {
            client.send(
              JSON.stringify({
                type: "RATE_UPDATE",
                currency: client.currentCurrency,
                rate: rate,
                baseCurrency: BASE_CURRENCY,
                timestamp: Date.now(),
              }),
            );
          }
        }
      });
    }
  }, BROADCAST_INTERVAL);

  console.log("[WSS] WebSocket server initialized on /exchange-rates");
  return wss;
}
