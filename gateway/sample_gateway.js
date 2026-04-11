import express from "express";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8082);

const merchants = new Map();
const payments = new Map();
const idempotency = new Map();
const DATA_FILE = new URL("./gateway-data.json", import.meta.url);
let persistQueue = Promise.resolve();

const STATUS = {
  CREATED: "created",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
};

const BANK_CODES = ["HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "YES", "PNB"];

function nowIso() {
  return new Date().toISOString();
}

function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function objectFromMap(map) {
  return Object.fromEntries(map.entries());
}

async function loadData() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    const loadedMerchants = mapFromObject(parsed.merchants);
    const loadedPayments = mapFromObject(parsed.payments);
    const loadedIdempotency = mapFromObject(parsed.idempotency);

    merchants.clear();
    payments.clear();
    idempotency.clear();

    loadedMerchants.forEach((value, key) => merchants.set(key, value));
    loadedPayments.forEach((value, key) => payments.set(key, value));
    loadedIdempotency.forEach((value, key) => idempotency.set(key, value));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load gateway-data.json", error);
    }
  }
}

function persistData() {
  const snapshot = {
    merchants: objectFromMap(merchants),
    payments: objectFromMap(payments),
    idempotency: objectFromMap(idempotency),
    updatedAt: nowIso(),
  };

  persistQueue = persistQueue
    .then(() => writeFile(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8"))
    .catch((error) => {
      console.error("Failed to persist gateway-data.json", error);
    });

  return persistQueue;
}

function amountInPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function isFutureExpiry(mmYY) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(mmYY || "");
  if (!match) return false;

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();

  return (
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1)
  );
}

function luhnCheck(cardNumber) {
  const digits = (cardNumber || "").replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function getCardNetwork(cardNumber) {
  const cleaned = (cardNumber || "").replace(/\s+/g, "");
  if (/^4/.test(cleaned)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(cleaned)) return "MASTERCARD";
  if (/^(34|37)/.test(cleaned)) return "AMEX";
  if (/^6(?:011|5)/.test(cleaned)) return "RUPAY";
  return "UNKNOWN";
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object") return "Invalid request body";
  if (!body.merchantId || !/^m_[a-zA-Z0-9_\-]{3,30}$/.test(body.merchantId)) {
    return "merchantId must look like m_store123";
  }
  if (!body.orderId || String(body.orderId).length < 3)
    return "orderId is required";
  if (!body.customerName || String(body.customerName).trim().length < 2)
    return "customerName is required";
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email)))
    return "Valid email is required";

  const paise = amountInPaise(body.amount);
  if (!Number.isFinite(paise) || paise < 100)
    return "Amount must be at least INR 1.00";

  if (!["card", "netbanking"].includes(body.paymentMethod)) {
    return "paymentMethod must be card or netbanking";
  }

  if (body.paymentMethod === "card") {
    if (!luhnCheck(body.cardNumber)) return "Invalid card number";
    if (!isFutureExpiry(body.cardExpiry))
      return "cardExpiry must be MM/YY and not expired";
    if (!/^\d{3,4}$/.test(String(body.cardCvv || ""))) return "Invalid CVV";
    if (!body.cardHolder || String(body.cardHolder).trim().length < 2)
      return "cardHolder is required";
  }

  if (body.paymentMethod === "netbanking") {
    if (!BANK_CODES.includes(String(body.bankCode || "").toUpperCase())) {
      return `bankCode must be one of: ${BANK_CODES.join(", ")}`;
    }
  }

  return null;
}

function createMerchantIfMissing(merchantId) {
  if (merchants.has(merchantId)) return merchants.get(merchantId);

  const merchant = {
    merchantId,
    displayName: `Demo Merchant ${merchantId.slice(2)}`,
    createdAt: nowIso(),
  };
  merchants.set(merchantId, merchant);
  return merchant;
}

function routePayment(method, details) {
  if (method === "card") {
    const network = getCardNetwork(details.cardNumber);
    const approved = network !== "UNKNOWN" && Math.random() > 0.07;
    return {
      network,
      bankReference: makeId("cardref"),
      finalStatus: approved ? STATUS.SUCCESS : STATUS.FAILED,
      message: approved
        ? "Card authorized and captured"
        : "Card declined by issuer",
    };
  }

  const approved = Math.random() > 0.1;
  return {
    network: "NETBANKING",
    bankReference: makeId("nbref"),
    finalStatus: approved ? STATUS.SUCCESS : STATUS.FAILED,
    message: approved
      ? "Netbanking payment successful"
      : "Bank authentication failed",
  };
}

app.post("/api/payments/create", async (req, res) => {
  const idempotencyKey = req.header("x-idempotency-key");
  if (!idempotencyKey) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing x-idempotency-key header" });
  }

  if (idempotency.has(idempotencyKey)) {
    const reused = idempotency.get(idempotencyKey);
    return res.status(200).json({
      ok: true,
      reused: true,
      payment: reused,
      receiptUrl: `/receipt/${reused.paymentId}`,
    });
  }

  const error = validateCreatePayload(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const {
    merchantId,
    orderId,
    customerName,
    email,
    amount,
    paymentMethod,
    cardNumber,
    cardHolder,
    bankCode,
  } = req.body;

  const merchant = createMerchantIfMissing(merchantId);
  const paymentId = makeId("pay");

  const payment = {
    paymentId,
    orderId,
    merchantId: merchant.merchantId,
    merchantName: merchant.displayName,
    customerName,
    email,
    amountPaise: amountInPaise(amount),
    currency: "INR",
    paymentMethod,
    methodMeta:
      paymentMethod === "card"
        ? {
            cardLast4: String(cardNumber).replace(/\s+/g, "").slice(-4),
            cardHolder,
            cardNetwork: getCardNetwork(cardNumber),
          }
        : {
            bankCode: String(bankCode).toUpperCase(),
          },
    gatewayStatus: STATUS.CREATED,
    gatewayMessage: "Payment initialized",
    bankReference: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  payments.set(paymentId, payment);

  payment.gatewayStatus = STATUS.PROCESSING;
  payment.gatewayMessage = "Routing through acquiring channel";
  payment.updatedAt = nowIso();

  setTimeout(() => {
    const result = routePayment(paymentMethod, { cardNumber, bankCode });
    const live = payments.get(paymentId);
    if (!live) return;
    live.gatewayStatus = result.finalStatus;
    live.bankReference = result.bankReference;
    live.gatewayMessage = result.message;
    live.updatedAt = nowIso();
    persistData();
  }, 1500);

  idempotency.set(idempotencyKey, payment);
  await persistData();

  return res.status(201).json({
    ok: true,
    payment,
    receiptUrl: `/receipt/${paymentId}`,
  });
});

app.get("/api/payments/:paymentId", (req, res) => {
  const payment = payments.get(req.params.paymentId);
  if (!payment)
    return res.status(404).json({ ok: false, error: "Payment not found" });
  return res.status(200).json({ ok: true, payment });
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gateway Sample 2</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Syne:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-1: #f4f8fb;
      --bg-2: #fefaf2;
      --ink: #18212b;
      --line: #d8e0e8;
      --brand-a: #0077b6;
      --brand-b: #f77f00;
      --shadow: 0 24px 55px rgba(24, 33, 43, 0.12);
      --ring: rgba(0, 119, 182, 0.2);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Outfit", sans-serif;
      color: var(--ink);
      min-height: 100vh;
      background:
        radial-gradient(circle at 5% 10%, rgba(0, 119, 182, 0.18), transparent 35%),
        radial-gradient(circle at 95% 0%, rgba(247, 127, 0, 0.18), transparent 32%),
        linear-gradient(135deg, var(--bg-1), var(--bg-2));
    }
    .wrap { max-width: 920px; margin: 26px auto; padding: 0 16px; }
    .hero {
      border-radius: 22px;
      background: linear-gradient(115deg, #083a5b, #0077b6);
      color: #f2fbff;
      padding: 24px;
      box-shadow: var(--shadow);
    }
    h1 { margin: 0; font-family: "Syne", sans-serif; font-size: clamp(26px, 4vw, 42px); }
    p { margin: 8px 0 0; }
    .card {
      margin-top: 16px;
      background: #fff;
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 18px;
    }
    label {
      display: block;
      margin: 8px 0 6px;
      font-size: 12px;
      font-weight: 600;
      color: #2e3b4a;
    }
    input, select, button {
      width: 100%;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--line);
      font: inherit;
      background: #fff;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 4px var(--ring);
    }
    .row { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .tabs { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; margin-bottom: 8px; }
    .tab {
      border-radius: 10px;
      border: 1px solid var(--line);
      text-align: center;
      padding: 10px;
      background: #f7fbff;
      cursor: pointer;
      font-weight: 600;
      user-select: none;
    }
    .tab.active { background: #e8f4ff; border-color: #93cfff; color: #064f78; }
    .btn {
      margin-top: 12px;
      border: none;
      color: #fff;
      font-weight: 700;
      background: linear-gradient(120deg, var(--brand-b), #ff9f1c);
      cursor: pointer;
    }
    .msg {
      margin-top: 12px;
      background: #f7fbff;
      border: 1px dashed #b8d2ea;
      border-radius: 12px;
      padding: 10px;
      min-height: 56px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>Gateway Checkout</h1>
      <p>Select payment method and pay. Receipt page will show final status and transaction ID.</p>
    </section>

    <section class="card">
      <label>Merchant ID</label>
      <input id="merchantId" value="m_store001" />

      <div class="row">
        <div>
          <label>Order ID</label>
          <input id="orderId" value="ORD2001" />
        </div>
        <div>
          <label>Amount (INR)</label>
          <input id="amount" type="number" min="1" value="1299" />
        </div>
      </div>

      <div class="row">
        <div>
          <label>Customer Name</label>
          <input id="customerName" value="Anik Gupta" />
        </div>
        <div>
          <label>Email</label>
          <input id="email" value="anik@example.com" />
        </div>
      </div>

      <label>Payment Method</label>
      <div class="tabs">
        <div id="tab-card" class="tab active" onclick="selectMethod('card')">Debit/Credit Card</div>
        <div id="tab-netbanking" class="tab" onclick="selectMethod('netbanking')">Netbanking</div>
      </div>

      <div id="cardFields">
        <div class="row">
          <div>
            <label>Card Number</label>
            <input id="cardNumber" value="4111 1111 1111 1111" />
          </div>
          <div>
            <label>Card Holder</label>
            <input id="cardHolder" value="ANIK GUPTA" />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Expiry (MM/YY)</label>
            <input id="cardExpiry" value="12/30" />
          </div>
          <div>
            <label>CVV</label>
            <input id="cardCvv" type="password" value="123" />
          </div>
        </div>
      </div>

      <div id="netbankingFields" style="display:none;">
        <label>Select Bank</label>
        <select id="bankCode">
          <option>SBI</option>
          <option>HDFC</option>
          <option>ICICI</option>
          <option>AXIS</option>
          <option>KOTAK</option>
          <option>YES</option>
          <option>PNB</option>
        </select>
      </div>

      <button class="btn" onclick="payNow()">Pay Now</button>
      <div id="msg" class="msg"></div>
    </section>
  </div>

  <script>
    let method = "card";

    function selectMethod(next) {
      method = next;
      const cardTab = document.getElementById("tab-card");
      const nbTab = document.getElementById("tab-netbanking");
      const card = document.getElementById("cardFields");
      const nb = document.getElementById("netbankingFields");

      if (method === "card") {
        cardTab.classList.add("active");
        nbTab.classList.remove("active");
        card.style.display = "block";
        nb.style.display = "none";
      } else {
        nbTab.classList.add("active");
        cardTab.classList.remove("active");
        card.style.display = "none";
        nb.style.display = "block";
      }
    }

    async function payNow() {
      const payload = {
        merchantId: document.getElementById("merchantId").value.trim(),
        orderId: document.getElementById("orderId").value.trim(),
        amount: Number(document.getElementById("amount").value),
        customerName: document.getElementById("customerName").value.trim(),
        email: document.getElementById("email").value.trim(),
        paymentMethod: method,
      };

      if (method === "card") {
        payload.cardNumber = document.getElementById("cardNumber").value.trim();
        payload.cardHolder = document.getElementById("cardHolder").value.trim();
        payload.cardExpiry = document.getElementById("cardExpiry").value.trim();
        payload.cardCvv = document.getElementById("cardCvv").value.trim();
      } else {
        payload.bankCode = document.getElementById("bankCode").value;
      }

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "idem_" + Math.random().toString(36).slice(2),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const msg = document.getElementById("msg");

      if (!data.ok) {
        msg.innerHTML = '<strong style="color:#b42318;">Error:</strong> ' + (data.error || "Payment failed");
        return;
      }

      msg.innerHTML = "Payment submitted. Redirecting to receipt...";
      window.location.href = data.receiptUrl;
    }
  </script>
</body>
</html>`);
});

app.get("/receipt/:paymentId", (req, res) => {
  const paymentId = req.params.paymentId;
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Receipt</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Syne:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --ok: #18794e;
      --bad: #b42318;
      --warn: #b54708;
      --ink: #1d2a37;
      --line: #dbe5ef;
      --shadow: 0 24px 55px rgba(24, 33, 43, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Outfit", sans-serif;
      color: var(--ink);
      background: linear-gradient(135deg, #edf6ff, #fff7ea);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .card {
      width: min(720px, 100%);
      background: #fff;
      border-radius: 20px;
      box-shadow: var(--shadow);
      padding: 22px;
    }
    h1 {
      margin: 0;
      font-family: "Syne", sans-serif;
      font-size: clamp(26px, 4vw, 38px);
    }
    .sub { margin: 8px 0 0; color: #4a5b6d; }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 10px;
    }
    .ok { background: #dcfce7; color: var(--ok); }
    .bad { background: #fee4e2; color: var(--bad); }
    .warn { background: #fef0c7; color: var(--warn); }
    .line {
      border-top: 1px dashed var(--line);
      margin: 14px 0;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 7px 0;
    }
    .key { color: #4d6072; }
    .val { font-weight: 600; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
    .actions {
      margin-top: 14px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      color: #fff;
      font-weight: 700;
      background: linear-gradient(120deg, #1d5f9a, #0077b6);
      text-decoration: none;
      display: inline-block;
    }
    .btn.alt {
      background: linear-gradient(120deg, #ce6d00, #f77f00);
    }
  </style>
</head>
<body>
  <section class="card">
    <h1>Payment Receipt</h1>
    <p class="sub">This page updates automatically until the final transaction status is received.</p>
    <div id="statusBadge" class="pill warn">processing</div>

    <div class="line"></div>

    <div class="row"><div class="key">Transaction ID</div><div id="txId" class="val mono"></div></div>
    <div class="row"><div class="key">Order ID</div><div id="orderId" class="val"></div></div>
    <div class="row"><div class="key">Amount</div><div id="amount" class="val"></div></div>
    <div class="row"><div class="key">Method</div><div id="method" class="val"></div></div>
    <div class="row"><div class="key">Gateway Message</div><div id="message" class="val"></div></div>
    <div class="row"><div class="key">Bank Reference</div><div id="bankRef" class="val mono">pending</div></div>
    <div class="row"><div class="key">Updated At</div><div id="updated" class="val"></div></div>

    <div class="actions">
      <a class="btn" href="/">Make Another Payment</a>
      <a class="btn alt" href="/track">Track by Transaction ID</a>
    </div>
  </section>

  <script>
    const paymentId = ${JSON.stringify(paymentId)};
    document.getElementById("txId").textContent = paymentId;

    function badgeClass(status) {
      if (status === "success") return "pill ok";
      if (status === "failed") return "pill bad";
      return "pill warn";
    }

    function methodText(p) {
      if (p.paymentMethod === "card") {
        return p.methodMeta.cardNetwork + " • xxxx " + p.methodMeta.cardLast4;
      }
      return "NETBANKING • " + p.methodMeta.bankCode;
    }

    async function refresh() {
      const res = await fetch("/api/payments/" + encodeURIComponent(paymentId));
      const data = await res.json();
      if (!data.ok) return;

      const p = data.payment;
      const badge = document.getElementById("statusBadge");
      badge.className = badgeClass(p.gatewayStatus);
      badge.textContent = p.gatewayStatus;

      document.getElementById("orderId").textContent = p.orderId;
      document.getElementById("amount").textContent = "INR " + (p.amountPaise / 100).toFixed(2);
      document.getElementById("method").textContent = methodText(p);
      document.getElementById("message").textContent = p.gatewayMessage;
      document.getElementById("bankRef").textContent = p.bankReference || "pending";
      document.getElementById("updated").textContent = new Date(p.updatedAt).toLocaleString();

      if (p.gatewayStatus === "success" || p.gatewayStatus === "failed") {
        clearInterval(timer);
      }
    }

    const timer = setInterval(refresh, 1200);
    refresh();
  </script>
</body>
</html>`);
});

app.get("/track", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Track Transaction</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 16px; }
    .card { max-width: 640px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
    input, button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #d4dbe3; font: inherit; }
    button { margin-top: 8px; border: none; background: #0b69a3; color: #fff; font-weight: 700; cursor: pointer; }
    .out { margin-top: 12px; background: #f7fbff; border: 1px dashed #c7dff1; border-radius: 8px; padding: 10px; min-height: 52px; }
  </style>
</head>
<body>
  <section class="card">
    <h2>Track Transaction</h2>
    <p>Paste Transaction ID from receipt.</p>
    <input id="paymentId" placeholder="pay_xxxxx" />
    <button onclick="track()">Track</button>
    <div id="out" class="out"></div>
    <p><a href="/">Back to Checkout</a></p>
  </section>

  <script>
    async function track() {
      const id = document.getElementById("paymentId").value.trim();
      if (!id) return;
      const res = await fetch("/api/payments/" + encodeURIComponent(id));
      const data = await res.json();
      const out = document.getElementById("out");
      if (!data.ok) {
        out.textContent = data.error || "Not found";
        return;
      }
      const p = data.payment;
      out.innerHTML =
        "Status: <b>" + p.gatewayStatus + "</b><br>" +
        "Message: " + p.gatewayMessage + "<br>" +
        "Order: " + p.orderId + "<br>" +
        "Bank Ref: " + (p.bankReference || "pending");
    }
  </script>
</body>
</html>`);
});

async function startServer() {
  await loadData();
  await persistData();
  app.listen(PORT, () => {
    console.log(`Gateway demo 2 running on http://localhost:${PORT}`);
    console.log("Flow: checkout -> receipt with transaction ID");
    console.log(`Data file: ${DATA_FILE.pathname}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
