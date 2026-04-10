const detectFraud = (amount) => {
  if (amount > 10000) return true;
  return false;
};

export default detectFraud;
