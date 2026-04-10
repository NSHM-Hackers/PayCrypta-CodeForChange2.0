// pages/KYC.jsx
import { useState, useEffect } from "react";
import axios from "../utils/axiosConfig";
import { useNavigate, Link } from "react-router-dom";
import { EventSourcePolyfill } from "event-source-polyfill";

function KYC() {
  const [form, setForm] = useState({
    fullName: "",
    documentType: "id_card",
    documentNumber: "",
    documentImage: ""
  });
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [animate, setAnimate] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setAnimate(true);
    fetchUserData();
    fetchKYCStatus();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const baseURL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : "http://localhost:8000";
    const sseUrl = `${baseURL}/api/sseupdates`;

    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
      heartbeatTimeout: 45000,
      withCredentials: false,
    });

    const handleKycStatusUpdate = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data?.status) return;

        setKycStatus((prev) => ({
          ...(prev || {}),
          status: data.status,
          reviewedAt: data.reviewedAt || prev?.reviewedAt,
          remarks: data.remarks || prev?.remarks,
        }));

        if (data.status === "approved") {
          setSuccess("KYC approved successfully.");
        }
      } catch (error) {
        console.error("KYC SSE parse error:", error);
      }
    };

    eventSource.addEventListener("kyc_status_updated", handleKycStatusUpdate);

    return () => {
      eventSource.close();
    };
  }, []);

  // Image compression function
  const compressImage = (file, maxSizeMB = 1, maxWidthOrHeight = 1200) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxWidthOrHeight) {
              height = Math.round((height * maxWidthOrHeight) / width);
              width = maxWidthOrHeight;
            }
          } else {
            if (height > maxWidthOrHeight) {
              width = Math.round((width * maxWidthOrHeight) / height);
              height = maxWidthOrHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress image
          let quality = 0.7;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // Check file size and adjust quality if needed
          let compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
          while (compressedSize > maxSizeMB * 1024 * 1024 && quality > 0.1) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
          }

          resolve(compressedDataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const fetchUserData = async () => {
    try {
      const response = await axios.get("/user/me");
      setUser(response.data);
      setForm(prev => ({
        ...prev,
        fullName: response.data.name
      }));
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchKYCStatus = async () => {
    try {
      const response = await axios.get("/kyc/status");
      setKycStatus(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setKycStatus({ status: "not_submitted" });
        return;
      }
      console.error("Error fetching KYC status:", error);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size first (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File is too large. Maximum size is 10MB.");
        return;
      }

      try {
        setUploadProgress(30);
        // Compress the image
        const compressedImage = await compressImage(file, 1, 1200);
        setUploadProgress(80);
        setPreviewImage(compressedImage);
        setForm({ ...form, documentImage: compressedImage });
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
        setError("");
      } catch (err) {
        console.error("Image compression error:", err);
        setError("Failed to process image. Please try again.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName || !form.documentType || !form.documentNumber || !form.documentImage) {
      setError("Please fill in all fields and upload document image");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/kyc/submit", form, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      setSuccess(response.data.message);
      setKycStatus({
        status: "pending",
        submittedAt: new Date().toISOString(),
      });
      fetchKYCStatus();

      // Reset form
      setForm({
        ...form,
        documentNumber: "",
        documentImage: ""
      });
      setPreviewImage(null);

      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    } catch (err) {
      if (err.response?.status === 413) {
        setError("Image is too large. Please upload a smaller image (under 1MB).");
      } else {
        const statusFromServer = err.response?.data?.details?.status;
        if (statusFromServer) {
          fetchKYCStatus();
        }
        setError(err.response?.data?.msg || err.response?.data?.message || "Failed to submit KYC");
      }
    } finally {
      setLoading(false);
    }
  };

  // If KYC already approved
  if (kycStatus?.status === "approved") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">KYC Verified!</h2>
          <p className="text-gray-600 mb-4">Your identity has been verified successfully.</p>
          <Link
            to="/dashboard"
            className="inline-block px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // If KYC pending
  if (kycStatus?.status === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">KYC Under Review</h2>
          <p className="text-gray-600 mb-2">Your KYC documents are being reviewed by our team.</p>
          <p className="text-sm text-gray-500">Auto-verification usually completes in about 10 seconds. Keep this page open for realtime updates.</p>
          <Link
            to="/dashboard"
            className="mt-6 inline-block px-6 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
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

        {/* Header */}
        <div className={`text-center mb-8 transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
          <div className="inline-block p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg animate-float">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            KYC Verification
          </h1>
          <p className="text-gray-600 mt-2">Verify your identity to unlock all features</p>
          <p className="text-sm text-gray-500 mt-1">Please upload clear images (Max size: 1MB)</p>
        </div>

        {/* Form Card */}
        <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-1000 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mt-16 -mr-16 animate-ping"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -mb-12 -ml-12 animate-pulse"></div>
            <h2 className="text-xl font-bold text-white relative z-10">Identity Verification</h2>
            <p className="text-indigo-100 text-sm relative z-10">Please provide your valid documents</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-600 rounded-r-lg animate-shake">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-600 rounded-r-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Enter your full name as per ID proof"
                    required
                  />
                </div>
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <select
                    value={form.documentType}
                    onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none bg-white"
                    required
                  >
                    <option value="passport">📘 Passport</option>
                    <option value="id_card">🪪 Government ID Card</option>
                    <option value="driving_license">🚗 Driving License</option>
                    <option value="pan_card">📄 PAN Card</option>
                    <option value="aadhar_card">🆔 Aadhar Card</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Document Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={form.documentNumber}
                    onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Enter document number"
                    required
                  />
                </div>
              </div>

              {/* Document Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Image <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-purple-500 transition-all hover:bg-purple-50/30">
                  <div className="space-y-1 text-center">
                    {previewImage ? (
                      <div className="mb-3">
                        <img src={previewImage} alt="Preview" className="max-h-40 mx-auto rounded-lg shadow-md" />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setForm({ ...form, documentImage: "" });
                          }}
                          className="mt-2 text-sm text-red-600 hover:text-red-700 transition"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none">
                            <span>Upload a file</span>
                            <input type="file" className="sr-only" accept="image/jpeg,image/png,image/jpg" onChange={handleImageChange} />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, JPEG up to 1MB (compressed)</p>
                      </>
                    )}
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-2">
                        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Compressing image... {uploadProgress}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-lg hover:shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </div>
                ) : (
                  "Submit KYC Application"
                )}
              </button>
            </form>

            {/* Info Note */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">Important Notes:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Your document should be clearly visible</li>
                    <li>Make sure all details match your profile information</li>
                    <li>Images will be automatically compressed to save space</li>
                    <li>KYC verification typically takes 24-48 hours</li>
                    <li>You will be notified once verification is complete</li>
                  </ul>
                </div>
              </div>
            </div>
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
          50% { transform: translateY(-10px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}

export default KYC;