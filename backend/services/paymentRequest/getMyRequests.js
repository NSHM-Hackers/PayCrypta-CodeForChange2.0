import PaymentRequest from "../../models/PaymentRequest.js";

export const getMyRequests = async (userId) => {
  const requests = await PaymentRequest.find({ requester: userId })
    .populate("requester", "name email")
    .sort({ createdAt: -1 });

  return requests;
};
