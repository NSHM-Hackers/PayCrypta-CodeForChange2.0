// src/pages/RequestPayment.jsx
import { useState, useEffect } from "react";
import axios from "../utils/axiosConfig";
import { useNavigate, Link } from "react-router-dom";

function RequestPayment() {
  const navigate = useNavigate();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [animate, setAnimate] = useState(false);
  const [activeTab, setActiveTab] = useState("sent");

  const isAuthed = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    setAnimate(true);
    if (!isAuthed) {
      setMessage("Please login to manage payment requests.");
      return;
    }

    fetchReceivedRequests();
    fetchSentRequests();
  }, []);

  const fetchReceivedRequests = async () => {
    try {
      const res = await axios.get("/paymentRequest/received");
      setReceivedRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setMessage(error.response?.data?.message || "Failed to load received requests");
    }
  };

  const fetchSentRequests = async () => {
    try {
      const res = await axios.get("/paymentRequest/sent");
      setSentRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
    } catch (error) {
      console.error("Error fetching sent requests:", error);
      setMessage(error.response?.data?.message || "Failed to load sent requests");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recipientEmail || !amount) {
      setMessage("Recipient email and amount are required.");
      return;
    }

    if (Number(amount) <= 0) {
      setMessage("Amount must be greater than 0.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.post("/paymentRequest/create", {
        recipientEmail,
        amount: Number(amount),
        note,
      });

      setMessage("✅ Request sent successfully!");
      setRecipientEmail("");
      setAmount("");
      setNote("");

      fetchSentRequests();
      fetchReceivedRequests();
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.post(`/paymentRequest/pay/${id}`);
      setMessage("✅ Payment successful!");
      fetchReceivedRequests();
      fetchSentRequests();
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (window.confirm("Are you sure you want to reject this request?")) {
      try {
        setLoading(true);
        await axios.post(`/paymentRequest/reject/${id}`);
        setMessage("❌ Request rejected");
        fetchReceivedRequests();
        fetchSentRequests();
        setTimeout(() => setMessage(""), 3000);
      } catch (error) {
        setMessage(error.response?.data?.message || "Failed to reject request");
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "paid":
        return "bg-gradient-to-r from-green-500 to-emerald-600 text-white";
      case "rejected":
        return "bg-gradient-to-r from-red-500 to-pink-600 text-white";
      default:
        return "bg-gradient-to-r from-yellow-500 to-orange-600 text-white";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return "✅";
      case "rejected":
        return "❌";
      default:
        return "⏳";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
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

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className={`text-center mb-8 transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
          <div className="inline-block">
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-float">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Request Payment
            </h1>
            <p className="text-gray-600 mt-2">Send and manage payment requests</p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-purple-600 transition-all duration-300 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Dashboard</span>
          </Link>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 animate-shake ${
            message.startsWith("✅") 
              ? "bg-green-50 border-green-500 text-green-700" 
              : message.startsWith("❌")
              ? "bg-red-50 border-red-500 text-red-700"
              : "bg-blue-50 border-blue-500 text-blue-700"
          }`}>
            <div className="flex items-center">
              <span className="text-xl mr-2">
                {message.startsWith("✅") ? "✓" : message.startsWith("❌") ? "✗" : "ℹ"}
              </span>
              <span>{message}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Request Form */}
          <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0.1s' }}>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mt-16 -mr-16 animate-ping"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -mb-12 -ml-12 animate-pulse"></div>
              <h2 className="text-xl font-bold text-white relative z-10">📝 Create Payment Request</h2>
              <p className="text-indigo-100 text-sm relative z-10">Request money from anyone</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📧 Recipient Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    placeholder="Enter recipient's email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💰 Amount
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-lg font-bold text-gray-400">₹</span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📝 Note (Optional)
                </label>
                <textarea
                  placeholder="Add a note or reason for the request..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Request...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Request
                  </div>
                )}
              </button>
            </form>
          </div>

          {/* Requests Tabs */}
          <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0.2s' }}>
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white">📋 Payment Requests</h2>
              <p className="text-purple-100 text-sm">Track and manage your requests</p>
            </div>

            {/* Tab Buttons */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("sent")}
                className={`flex-1 py-3 text-center font-medium transition-all duration-200 ${
                  activeTab === "sent"
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                📤 Sent ({sentRequests.length})
              </button>
              <button
                onClick={() => setActiveTab("received")}
                className={`flex-1 py-3 text-center font-medium transition-all duration-200 ${
                  activeTab === "received"
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                📥 Received ({receivedRequests.length})
              </button>
            </div>

            <div className="p-6 max-h-[500px] overflow-y-auto">
              {activeTab === "sent" && (
                <>
                  {sentRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500">No sent requests yet</p>
                      <p className="text-sm text-gray-400 mt-1">Create your first payment request above</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sentRequests.map((req, index) => (
                        <div
                          key={req._id}
                          className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 animate-fade-in-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">To: {req.recipientEmail}</p>
                                <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(req.status)}`}>
                              {getStatusIcon(req.status)} {req.status}
                            </span>
                          </div>
                          <div className="pl-10">
                            <p className="text-2xl font-bold text-gray-800">{formatCurrency(req.amount)}</p>
                            {req.note && <p className="text-sm text-gray-500 mt-1">Note: {req.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === "received" && (
                <>
                  {receivedRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500">No received requests yet</p>
                      <p className="text-sm text-gray-400 mt-1">When someone requests money, it will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {receivedRequests.map((req, index) => (
                        <div
                          key={req._id}
                          className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 animate-fade-in-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">From: {req.requester?.email || "Unknown"}</p>
                                <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(req.status)}`}>
                              {getStatusIcon(req.status)} {req.status}
                            </span>
                          </div>
                          <div className="pl-10">
                            <p className="text-2xl font-bold text-gray-800">{formatCurrency(req.amount)}</p>
                            {req.note && <p className="text-sm text-gray-500 mt-1">Note: {req.note}</p>}
                          </div>
                          {req.status === "pending" && (
                            <div className="flex gap-3 mt-4 pl-10">
                              <button
                                onClick={() => handlePay(req._id)}
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
                              >
                                💳 Pay Now
                              </button>
                              <button
                                onClick={() => handleReject(req._id)}
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
                              >
                                ❌ Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className={`mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0.3s' }}>
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all transform hover:scale-105">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Instant Requests</p>
            <p className="text-xs text-gray-500">Send payment requests instantly</p>
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
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Real-time Updates</p>
            <p className="text-xs text-gray-500">Get notified when paid</p>
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
        
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
          opacity: 0;
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

export default RequestPayment;