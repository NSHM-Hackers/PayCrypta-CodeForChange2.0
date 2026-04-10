// src/pages/RequestPayment.jsx
import { useState, useEffect } from "react";
import axios from "../utils/axiosConfig";
import { useNavigate } from "react-router-dom";

function RequestPayment() {
  const navigate = useNavigate();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isAuthed = Boolean(localStorage.getItem("token"));

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

  useEffect(() => {
    if (!isAuthed) {
      setMessage("Please login to manage payment requests.");
      return;
    }

    fetchReceivedRequests();
    fetchSentRequests();
  }, []);

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

      setMessage("Request sent successfully.");
      setRecipientEmail("");
      setAmount("");
      setNote("");

      fetchSentRequests();
      fetchReceivedRequests();
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
      setMessage("Payment successful.");
      fetchReceivedRequests();
      fetchSentRequests();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">📩 Request Payment</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 transition"
        >
          Back to Dashboard
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
          {message}
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">📩 Request Payment</h2>

      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded shadow">
        <input
          type="email"
          placeholder="Recipient Email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? "Please wait..." : "Send Request"}
        </button>
      </form>

      <h2 className="text-xl font-bold mt-8 mb-4">📤 Requests You Sent</h2>

      <div className="space-y-3">
        {sentRequests.length === 0 ? (
          <p>No sent requests yet</p>
        ) : (
          sentRequests.map((req) => (
            <div
              key={req._id}
              className="border p-4 rounded flex justify-between items-center"
            >
              <div>
                <p><strong>To:</strong> {req.recipientEmail}</p>
                <p><strong>Amount:</strong> ₹{req.amount}</p>
                <p><strong>Note:</strong> {req.note || "-"}</p>
                <p className="mt-1">
                  <strong>Status:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(req.status)}`}>
                    {req.status}
                  </span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">📥 Requests Received</h2>

      <div className="space-y-3">
        {receivedRequests.length === 0 ? (
          <p>No requests yet</p>
        ) : (
          receivedRequests.map((req) => (
            <div
              key={req._id}
              className="border p-4 rounded flex justify-between items-center"
            >
              <div>
                <p><strong>From:</strong> {req.requester?.email}</p>
                <p><strong>Amount:</strong> ₹{req.amount}</p>
                <p><strong>Note:</strong> {req.note}</p>
                <p><strong>Status:</strong> {req.status}</p>
              </div>

              {req.status === "pending" && (
                <button
                  onClick={() => handlePay(req._id)}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  {loading ? "Processing..." : "Pay"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RequestPayment;