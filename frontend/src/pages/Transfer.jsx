// pages/Transfer.jsx
import { useState, useEffect, useRef } from "react";
import axios from "../utils/axiosConfig";
import { useNavigate } from "react-router-dom";

const UI_PREVIEW_CHARGE_RATE = 0.03;

function Transfer() {
  const [form, setForm] = useState({
    receiver: "",
    amount: "",
    fromCurrency: "INR",
    toCurrency: "INR",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({ INR: 1 });
  const [animate, setAnimate] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const transferWsRef = useRef(null);
  const subscribedCurrencyRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    setAnimate(true);
    fetchUserData();
    fetchRecentTransfers();
    setupExchangeRateWebSocket();

    return () => {
      if (transferWsRef.current && transferWsRef.current.readyState === WebSocket.OPEN) {
        transferWsRef.current.close();
      }
      transferWsRef.current = null;
      subscribedCurrencyRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (form.toCurrency !== "INR") {
      subscribeToCurrency(form.toCurrency);
    }
  }, [form.toCurrency]);

  useEffect(() => {
    if (form.toCurrency === "INR") {
      setExchangeRate(1);
      return;
    }

    const rate = Number(exchangeRates[form.toCurrency] || 0);
    setExchangeRate(rate || null);
  }, [form.toCurrency, exchangeRates]);

  const subscribeToCurrency = (currency) => {
    const ws = transferWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (subscribedCurrencyRef.current === currency) return;

    ws.send(JSON.stringify({ type: "SUBSCRIBE", currency }));
    subscribedCurrencyRef.current = currency;
  };

  const setupExchangeRateWebSocket = () => {
    try {
      const baseURL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : "http://localhost:8000";
      const wsProtocol = baseURL.startsWith('https') ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${baseURL.replace(/^https?:\/\//, '')}/exchange-rates`;

      const ws = new WebSocket(wsUrl);
      transferWsRef.current = ws;

      ws.onopen = () => {
        subscribeToCurrency(form.toCurrency);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'RATE_UPDATE' && data.currency) {
            setExchangeRates((prev) => ({
              ...prev,
              [data.currency]: Number(data.rate),
            }));
          }
        } catch (error) {
          console.error("Error parsing rate update:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket rate error:", error);
      };
    } catch (error) {
      console.error("Failed to initialize exchange rate websocket:", error);
    }
  };

  const fetchUserData = async () => {
    try {
      if (!localStorage.getItem("token")) {
        setMessage("❌ You are not logged in!");
        return;
      }
      const res = await axios.get("/user/me");
      setUser(res.data);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchRecentTransfers = async () => {
    try {
      if (!localStorage.getItem("token")) return;
      const res = await axios.get("/payment/history?limit=3&offset=0");
      setRecentTransfers(res.data.transactions || []);
    } catch (error) {
      console.error("Error fetching recent transfers:", error);
    }
  };

  const handleTransfer = async () => {
    setMessage("");

    if (!form.receiver || !form.amount) {
      setMessage("⚠️ Please fill in all fields.");
      return;
    }

    if (isNaN(form.amount) || Number(form.amount) <= 0) {
      setMessage("⚠️ Enter a valid positive amount.");
      return;
    }

    if (!localStorage.getItem("token")) {
      setMessage("❌ You are not logged in!");
      return;
    }

    try {
      setLoading(true);

      const transferPayload = {
        receiver: form.receiver,
        recipientId: form.receiver,
        amount: Number(form.amount),
        fromCurrency: form.fromCurrency,
        toCurrency: form.toCurrency,
      };

      const res = await axios.post(
        "/payment/transfer",
        transferPayload
      );

      const tx = res.data.transaction;
      setMessage(
        tx
          ? `✅ Success! Sent ${tx.amount} ${tx.fromCurrency} to ${tx.to?.name || tx.to?.email || "recipient"}. Received: ${tx.convertedAmount} ${tx.toCurrency}`
          : res.data.message || "✅ Transfer completed successfully!"
      );

      setForm({ ...form, amount: "" });
      fetchUserData(); // Refresh balance
      fetchRecentTransfers(); // Refresh recent transfers

      // Clear success message and redirect after 2 seconds
      setTimeout(() => {
        navigate("/dashboard", { state: { refresh: true } });
      }, 2000);

    } catch (error) {
      console.error(error);

      if (error.response) {
        setMessage(`❌ Error: ${error.response.data.msg || error.response.data.message || "Server error"}`);
      } else if (error.request) {
        setMessage("❌ Error: No response from server. Please check your connection.");
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setForm({ ...form, amount: value });
    }
  };

  const getConvertedAmount = () => {
    if (!form.amount || !exchangeRate) return "0.00";
    const amount = parseFloat(form.amount);
    if (isNaN(amount)) return "0.00";
    const charge = amount * UI_PREVIEW_CHARGE_RATE;
    const netAmount = amount - charge;
    return (netAmount * exchangeRate).toFixed(2);
  };

  const getChargeAmount = () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount)) return "0.00";
    return (amount * UI_PREVIEW_CHARGE_RATE).toFixed(2);
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-purple-600 transition-all duration-300 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>

        {/* Header */}
        <div className={`text-center mb-8 transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
          <div className="inline-block">
            <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-float">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Make a Payment
            </h1>
            <p className="text-gray-600 mt-2">Transfer funds from your Indian Rupee account</p>
          </div>
        </div>

        {/* Main Card */}
        <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Account Balance Banner */}
          {user && (
            <div className="bg-gradient-to-r from-orange-600 via-indigo-600 to-purple-600 p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mt-16 -mr-16 animate-ping"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -mb-12 -ml-12 animate-pulse"></div>
              <div className="flex justify-between items-center text-white relative z-10">
                <div>
                  <p className="text-sm opacity-90">Your Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(user.balance || 0, "INR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Available for transfer</p>
                  <p className="text-sm font-semibold">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 md:p-8">
            {/* Message Alert */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg border-l-4 animate-shake ${message.startsWith("✅")
                ? "bg-green-50 border-green-500 text-green-700"
                : message.startsWith("⚠️")
                  ? "bg-yellow-50 border-yellow-500 text-yellow-700"
                  : "bg-red-50 border-red-500 text-red-700"
                }`}>
                <div className="flex items-center">
                  <span className="text-xl mr-2">
                    {message.startsWith("✅") ? "✓" : message.startsWith("⚠️") ? "⚠" : "✗"}
                  </span>
                  <span>{message}</span>
                </div>
              </div>
            )}

            {/* Transfer Form */}
            <div className="space-y-6">
              {/* Receiver Input */}
              <div className="transform transition-all duration-300 hover:scale-[1.02]">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  👤 Receiver Email or ID
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                    placeholder="Enter email or user ID"
                    value={form.receiver}
                    onChange={(e) => setForm({ ...form, receiver: e.target.value })}
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="transform transition-all duration-300 hover:scale-[1.02]">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💰 Amount (INR)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-lg font-bold text-gray-400">₹</span>
                  </div>
                  <input
                    className="w-full pl-12 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={handleAmountChange}
                  />
                </div>
              </div>

              {/* Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Currency - Only INR (Disabled/Readonly) */}
                <div className="transform transition-all duration-300">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    💱 From Currency
                  </label>
                  <div className="relative">
                    <div className="w-full p-3 border-2 border-orange-200 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100 cursor-default">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">🇮🇳</span>
                          <span className="font-semibold text-gray-800">INR - Indian Rupee</span>
                        </div>
                        <div className="bg-orange-200 rounded-full px-2 py-0.5 text-xs font-semibold text-orange-700">
                          Only Available
                        </div>
                      </div>
                    </div>
                    <input type="hidden" value="INR" />
                  </div>
                </div>

                {/* To Currency - All Options Available */}
                <div className="transform transition-all duration-300 hover:scale-[1.02]">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    🎯 To Currency
                  </label>
                  <select
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white cursor-pointer"
                    value={form.toCurrency}
                    onChange={(e) => setForm({ ...form, toCurrency: e.target.value })}
                  >
                    <option value="INR">🇮🇳 INR - Indian Rupee</option>
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                    <option value="CAD">🇨🇦 CAD - Canadian Dollar</option>
                    <option value="SGD">🇸🇬 SGD - Singapore Dollar</option>
                    <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
                    <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
                    <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
                    <option value="NZD">🇳🇿 NZD - New Zealand Dollar</option>
                  </select>
                </div>
              </div>

              {/* Exchange Rate Display */}
              {exchangeRate && form.amount && form.toCurrency !== "INR" && (
                <div className="bg-gradient-to-r from-orange-50 to-purple-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Exchange Rate</p>
                      <p className="text-lg font-bold text-orange-600">
                        1 INR = {exchangeRate} {form.toCurrency}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Total Charge (3%): {formatCurrency(getChargeAmount(), "INR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Receipient will Receive</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
                        {formatCurrency(getConvertedAmount(), form.toCurrency)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Same Currency Note */}
              {form.toCurrency === "INR" && form.amount && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-blue-700">
                      Sending within India - 3% charge: {formatCurrency(getChargeAmount(), "INR")}. Recipient receives {formatCurrency(getConvertedAmount(), "INR")}.
                    </p>
                  </div>
                </div>
              )}

              {/* Transfer Button */}
              <button
                onClick={handleTransfer}
                disabled={loading}
                className="relative w-full bg-gradient-to-r from-orange-600 via-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Transaction...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Money (INR)
                  </div>
                )}
              </button>

              {/* Info Note */}
              <div className="text-center text-sm text-gray-500 mt-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <svg className="w-4 h-4 inline-block mr-1 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Funds will be transferred instantly from your INR account. International transfers use real-time exchange rates.
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transfers */}
        {recentTransfers.length > 0 && (
          <div className={`mt-8 bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0.3s' }}>
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-lg font-semibold text-gray-800">Recent Transfers</h3>
              <p className="text-sm text-gray-500 mt-1">Your latest transactions</p>
            </div>
            <div className="divide-y divide-gray-200">
              {recentTransfers.map((transfer, index) => (
                <div key={transfer.id || index} className="p-4 hover:bg-gray-50 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">To: {transfer.to?.name || transfer.to?.email || "User"}</p>
                        <p className="text-xs text-gray-500">{new Date(transfer.date || transfer.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">-{formatCurrency(transfer.amount, "INR")}</p>
                      <p className="text-xs text-gray-500">INR → {transfer.toCurrency || "INR"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Tips */}
        <div className={`mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0.4s' }}>
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all transform hover:scale-105">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Instant Transfer</p>
            <p className="text-xs text-gray-500">Funds arrive within seconds</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all transform hover:scale-105">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4V6a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Secure & Safe</p>
            <p className="text-xs text-gray-500">Bank-level encryption</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all transform hover:scale-105">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Best Exchange Rates</p>
            <p className="text-xs text-gray-500">Real-time INR conversion</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

export default Transfer;