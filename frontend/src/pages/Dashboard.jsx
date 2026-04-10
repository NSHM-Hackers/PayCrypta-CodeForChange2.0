// pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import axios from "../utils/axiosConfig";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { EventSourcePolyfill } from "event-source-polyfill";
import EditProfile from "../components/EditProfile";
import ChangePassword from "../components/ChangePassword";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [kycStatus, setKycStatus] = useState("not_submitted");
  const [kycDetails, setKycDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    totalTransactions: 0,
    monthlyTransactions: 0
  });
  const [animate, setAnimate] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({
    USD: 0.0125,
    EUR: 0.0115,
    CAD: 0.0172,
    SGD: 0.0168,
    AUD: 0.0183,
    GBP: 0.0098,
    JPY: 1.75,
    CHF: 0.0113,
    NZD: 0.0191
  });
  const [convertAmount, setConvertAmount] = useState("1000");
  const [lastRateUpdatedAt, setLastRateUpdatedAt] = useState(null);

  // Modal states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const websocketRef = useRef(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("dashboardUser");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    }
  }, []);

  useEffect(() => {
    setAnimate(true);
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchAllData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCurrencyDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  // Refresh data when coming back from transfer page
  useEffect(() => {
    if (location.state?.refresh) {
      fetchAllData();
    }
  }, [location]);

  // Setup SSE connection for real-time transaction and KYC updates
  useEffect(() => {
    if (!user || !user._id) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const baseURL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : "http://localhost:8000";
    const sseUrl = `${baseURL}/api/sseupdates`;

    console.log(`[SSE] Attempting to connect: ${sseUrl}`);

    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
      heartbeatTimeout: 45000,
      withCredentials: false,
    });

    const handleTransactionStatusUpdate = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        const transactionId = updatedData.transactionId || updatedData.txId;
        if (!transactionId) return;

        setTransactions(prev => prev.map(tx =>
          String(tx.id || tx._id) === String(transactionId)
            ? {
              ...tx,
              status: updatedData.status || tx.status,
              blockchainId: updatedData.blockchainId || tx.blockchainId,
            }
            : tx
        ));
      } catch (error) {
        console.error('[SSE] Error parsing transaction status message:', error);
      }
    };

    const handleTransactionReceived = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        const transactionId = updatedData.transactionId || updatedData.txId;
        if (!transactionId) return;

        setTransactions(prev => prev.map(tx =>
          String(tx.id || tx._id) === String(transactionId)
            ? {
              ...tx,
              status: updatedData.status || tx.status,
              blockchainId: updatedData.blockchainId || tx.blockchainId,
            }
            : tx
        ));
      } catch (error) {
        console.error('[SSE] Error parsing transaction received message:', error);
      }
    };

    const handleKycStatusUpdate = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        if (!updatedData.status) return;

        setKycStatus(updatedData.status);
        setKycDetails(prev => ({
          ...(prev || {}),
          ...updatedData,
        }));
      } catch (error) {
        console.error('[SSE] Error parsing KYC update message:', error);
      }
    };

    eventSource.addEventListener('connected', (event) => {
      console.log('[SSE] Connected:', event.data);
    });
    eventSource.addEventListener('transaction_status_updated', handleTransactionStatusUpdate);
    eventSource.addEventListener('transaction_received', handleTransactionReceived);
    eventSource.addEventListener('kyc_status_updated', handleKycStatusUpdate);

    eventSource.onmessage = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        if (updatedData.type === 'transaction_status_updated') {
          handleTransactionStatusUpdate(event);
        } else if (updatedData.type === 'transaction_received') {
          handleTransactionReceived(event);
        } else if (updatedData.type === 'kyc_status_updated') {
          handleKycStatusUpdate(event);
        }
      } catch {
        // Ignore keepalive comments and non-JSON chunks.
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
    };

    console.log('[SSE] Connection opened');

    return () => {
      eventSource.close();
      console.log('[SSE] Connection closed');
    };
  }, [user]);

  // Setup WebSocket connection for live exchange rates
  useEffect(() => {
    const baseURL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : "http://localhost:8000";
    const wsProtocol = baseURL.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${baseURL.replace(/^https?:\/\//, '')}/exchange-rates`;

    console.log(`[WSS] Attempting to connect: ${wsUrl}`);

    try {
      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        console.log('[WSS] Connected to WebSocket server');
        // Subscribe to the selected currency
        websocketRef.current.send(JSON.stringify({
          type: 'SUBSCRIBE',
          currency: selectedCurrency
        }));
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[WSS] Received rate update:`, data);

          if (data.type === 'RATE_UPDATE' && data.currency) {
            const incomingTimestamp = data.timestamp || Date.now();

            setExchangeRates(prev => {
              return {
                ...prev,
                [data.currency]: data.rate
              };
            });

            if (data.currency === selectedCurrency) {
              setLastRateUpdatedAt(new Date(incomingTimestamp));
            }
          }
        } catch (error) {
          console.error('[WSS] Error parsing message:', error);
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('[WSS] WebSocket error:', error);
      };

      websocketRef.current.onclose = () => {
        console.log('[WSS] WebSocket connection closed');
      };
    } catch (error) {
      console.error('[WSS] Failed to initialize WebSocket:', error);
    }

    // Cleanup on unmount
    return () => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
        console.log('[WSS] WebSocket connection cleanup');
      }
    };
  }, []);

  // Handle currency dropdown change - send new subscription
  useEffect(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      console.log(`[WSS] Subscribing to: ${selectedCurrency}`);
      websocketRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE',
        currency: selectedCurrency
      }));
    }
  }, [selectedCurrency]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const userRes = await axios.get("/user/me");
      const userData = userRes.data;
      setUser(userData);

      // Save to localStorage for persistence
      localStorage.setItem("dashboardUser", JSON.stringify(userData));

      const statsRes = await axios.get("/user/stats");
      const statsData = {
        totalBalance: Number(statsRes.data?.totalBalance || 0),
        monthlyIncome: Number(statsRes.data?.monthlyIncome || 0),
        monthlyExpenses: Number((statsRes.data?.monthlyExpenses ?? statsRes.data?.monthlyExpense) || 0),
        totalTransactions: Number((statsRes.data?.totalTransactions ?? statsRes.data?.transactionCount) || 0),
        monthlyTransactions: Number(statsRes.data?.monthlyTransactions || 0),
      };
      setStats(statsData);

      try {
        const kycRes = await axios.get("/kyc/status");
        setKycStatus(kycRes.data.status);
        setKycDetails(kycRes.data);
      } catch (kycErr) {
        setKycStatus("not_submitted");
      }

      const transactionsRes = await axios.get("/payment/history?limit=10&offset=0");
      let transactionsList = [];
      if (Array.isArray(transactionsRes.data)) {
        transactionsList = transactionsRes.data;
      } else if (Array.isArray(transactionsRes.data?.transactions)) {
        transactionsList = transactionsRes.data.transactions;
      }
      setTransactions(transactionsList);
      setError("");

    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
      } else {
        setError("Failed to load dashboard data. Please refresh the page.");
        // Set demo user data if API fails
        const demoUser = { name: "Demo User", email: "demo@example.com", phone: "+91 9876543210", _id: "demo123456", role: "user", balance: 125000 };
        setUser(demoUser);
        localStorage.setItem("dashboardUser", JSON.stringify(demoUser));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("dashboardUser");
      navigate("/");
    }
  };

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const formatINR = (amount) => {
    if (amount === undefined || amount === null) return "₹0.00";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getConvertedBalance = () => {
    const inrBalance = stats.totalBalance || 0;
    const rate = exchangeRates[selectedCurrency];
    if (!rate) return `$0.00`;
    const converted = inrBalance * rate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2
    }).format(converted);
  };

  const getKycStatusText = () => {
    switch (kycStatus) {
      case "approved":
        return "Approved ✓";
      case "pending":
        return "Pending Review ⏳";
      case "rejected":
        return "Rejected ✗";
      default:
        return "Not Submitted ⚠️";
    }
  };

  const getTransactionStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "success":
      case "completed":
        return {
          text: "Verified on Blockchain ✓",
          color: "bg-green-100 text-green-700",
          icon: "🔗"
        };
      case "pending":
        return {
          text: "Pending Verification ⏳",
          color: "bg-yellow-100 text-yellow-700",
          icon: "⏱️"
        };
      case "failed":
        return {
          text: "Failed ✗",
          color: "bg-red-100 text-red-700",
          icon: "❌"
        };
      default:
        return {
          text: "Pending ⏳",
          color: "bg-gray-100 text-gray-600",
          icon: "🔄"
        };
    }
  };

  const currentRate = Number(exchangeRates[selectedCurrency] || 0);
  const convertedInputValue = Number(convertAmount || 0) * currentRate;
  const inrPerUnit = currentRate ? (1 / currentRate) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-300 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-white font-medium text-lg">Loading your dashboard...</p>
          <p className="text-purple-200 text-sm mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30">
      {/* Edit Profile Modal */}
      <EditProfile
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        user={user}
        onUpdate={handleUpdateUser}
      />

      {/* Change Password Modal */}
      <ChangePassword
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Navigation Bar */}
      <nav className="bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-50 border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <span className="text-4xl animate-wave">👋</span>
              <h2 className="text-2xl md:text-3xl font-bold">Welcome back, <span className="text-blue-700">{user?.name?.split(' ')[0] || "User"}!</span></h2>
            </Link>

            <div className="flex items-center space-x-4">
              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-3 focus:outline-none group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold shadow-md group-hover:scale-110 transition-transform">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold text-gray-800">{user?.name || "User"}</p>
                    <p className="text-xs text-purple-600">{user?.email}</p>
                  </div>
                  <svg className={`w-4 h-4 text-purple-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-slide-down">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowEditProfileModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition text-sm text-gray-700"
                    >
                      ✏️ Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowChangePasswordModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition text-sm text-gray-700"
                    >
                      🔒 Change Password
                    </button>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        🚪 Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Same as before */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 text-red-700 rounded-r-lg animate-slide-in-right">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-xl mr-2">⚠️</span>
                {error}
              </div>
              <button onClick={() => fetchAllData()} className="text-red-600 hover:text-red-800 text-sm font-medium">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className={`mb-8 transition-all duration-1000 transform ${animate ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 rounded-3xl p-6 md:p-8 text-white shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-300 opacity-10 rounded-full -ml-24 -mb-24 animate-pulse"></div>
            <div className="relative">
              <p className="text-indigo-100 text-sm md:text-base">Here's what's happening with your account today.</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium">
                  📊 {stats.totalTransactions} total transactions
                </div>
                {stats.monthlyTransactions > 0 && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium">
                    📈 {stats.monthlyTransactions} this month
                  </div>
                )}
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium">
                  🕒 {currentTime.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Card - Full Width */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-white/80">Total Balance</p>
                  <p className="text-3xl font-bold text-white mt-1">{formatINR(stats.totalBalance)}</p>
                </div>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                    className="bg-white/20 hover:bg-white/30 rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 transition text-white"
                  >
                    {selectedCurrency}
                    <svg className={`w-3 h-3 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showCurrencyDropdown && (
                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-slide-down">
                      {Object.keys(exchangeRates).map((currency) => (
                        <button
                          key={currency}
                          onClick={() => {
                            setSelectedCurrency(currency);
                            setShowCurrencyDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition ${selectedCurrency === currency ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-700'}`}
                        >
                          {currency}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-white mt-1">Equivalent: {getConvertedBalance()} {selectedCurrency}</p>
              <div className="mt-3 text-sm text-white/90">
                Current Rate: <span className="font-semibold">1 INR = {currentRate.toFixed(4)} {selectedCurrency}</span>
                <span className="mx-2 text-white/60">|</span>
                <span>1 {selectedCurrency} = {inrPerUnit.toFixed(2)} INR</span>
              </div>

              <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-xs text-white/80 font-semibold uppercase">Quick Converter</p>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="w-full sm:w-auto flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={convertAmount}
                      onChange={(e) => setConvertAmount(e.target.value)}
                      className="w-full sm:w-44 px-3 py-2 rounded-lg border border-white/30 bg-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                      placeholder="Enter INR"
                    />
                    <span className="text-sm font-semibold text-white">INR</span>
                  </div>
                  <p className="text-sm text-white/95">
                    {Number(convertAmount || 0).toLocaleString('en-IN')} INR = <span className="font-bold">{convertedInputValue.toFixed(2)} {selectedCurrency}</span>
                  </p>
                </div>
                <p className="text-xs text-white/70 mt-2">
                  Last update: {lastRateUpdatedAt ? lastRateUpdatedAt.toLocaleTimeString() : "Waiting for first live tick"}
                </p>
              </div>

              <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full" style={{ width: `${Math.min((stats.totalBalance / 200000) * 100, 100)}%` }}></div>
              </div>
              <div className="mt-4 flex justify-between text-white/60 text-xs">
                <span>💰 Available Balance</span>
                <span>💳 Wallet ID: {user?._id?.slice(-8) || "****1234"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Send/Pay and Request Payment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            to="/transfer"
            state={{ fromDashboard: true }}
            className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative p-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">💸 Send/Pay money</h3>
                <p className="text-indigo-100">Transfer funds instantly to anyone</p>
                <div className="mt-3 flex items-center text-indigo-200 text-sm group-hover:translate-x-2 transition-transform">
                  <span>Start sending</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
          </Link>

          <Link
            to="/request-payment"
            className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative p-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">📋 Request a payment</h3>
                <p className="text-emerald-100">Request funds from anyone</p>
                <div className="mt-3 flex items-center text-emerald-200 text-sm group-hover:translate-x-2 transition-transform">
                  <span>Create request</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
        {/* Monthly Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100">
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">📈 MONTHLY INCOME</p>
            <p className="text-2xl font-bold text-green-700 mt-2">{formatINR(stats.monthlyIncome)}</p>
            <p className="text-xs text-green-500 mt-1">+8.2% from last month</p>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-5 border border-red-100">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">📉 MONTHLY EXPENSES</p>
            <p className="text-2xl font-bold text-red-700 mt-2">{formatINR(stats.monthlyExpenses)}</p>
            <p className="text-xs text-red-500 mt-1">-3.1% from last month</p>
          </div>
          <Link
            to="/kyc"
            className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100 hover:shadow-lg transition-all cursor-pointer block"
          >
            <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">✅ KYC STATUS</p>
            <p className="text-2xl font-bold text-purple-700 mt-2">{getKycStatusText()}</p>
            <p className="text-xs text-purple-500 mt-1">Click to update verification</p>
          </Link>
        </div>
        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8 border border-indigo-100">
          <div className="px-6 py-5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Recent Transactions
              </h3>
              <p className="text-sm text-gray-500 mt-1">Your latest financial activities with blockchain verification</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Person/Account Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status / Verification to Blockchain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No transactions yet</p>
                      <p className="text-sm text-gray-400 mt-1">Start by sending or receiving money</p>
                      <Link to="/transfer" className="mt-4 inline-flex items-center px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105">
                        Send Money
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, index) => {
                    const statusBadge = getTransactionStatusBadge(tx.status);
                    return (
                      <tr key={tx.id || tx._id || index} className="hover:bg-indigo-50/40 transition-all duration-200 group">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(tx.date || tx.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === "sent" || tx.type === "withdrawal" ? "bg-red-100" : "bg-green-100"}`}>
                              <span className="text-lg">{tx.type === "sent" || tx.type === "withdrawal" ? "📤" : "📥"}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{tx.counterpartyName || tx.description || (tx.type === 'sent' ? 'External Transfer' : 'Deposit')}</p>
                              <p className="text-xs text-gray-400">{tx.type === "sent" || tx.type === "withdrawal" ? "Sent" : "Received"}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-lg font-bold ${tx.type === "sent" || tx.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                          {tx.type === "sent" || tx.type === "withdrawal" ? "-" : "+"}{formatINR(tx.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.color}`}>
                              <span>{statusBadge.icon}</span>
                              {statusBadge.text}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          75% { transform: rotate(-10deg); }
        }
        
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
          opacity: 0;
        }
        
        .animate-wave {
          animation: wave 0.5s ease-in-out;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;