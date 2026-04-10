import axios from "axios";

const BASE_CURRENCY = "INR";
const CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Cache configuration
let rateCache = null;
let lastFetchTime = 0;

// Function to fetch exchange rates from API
async function fetchExchangeRates() {
  const now = Date.now();

  // Do not fetch if we have cached data AND the data is younger than 1 hour
  if (rateCache && now - lastFetchTime <= CACHE_DURATION) {
    return rateCache;
  }

  try {
    console.log("Fetching fresh exchange rates from API...");
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`,
      {
        timeout: 5000,
      },
    );

    rateCache = response.data.rates;
    lastFetchTime = now;

    console.log("Successfully updated exchange rate cache");
    return rateCache;
  } catch (error) {
    console.error("API Error:", error.message);
    // If API fails, we keep using the old cache
    return rateCache;
  }
}

export const getExchangeRate = async (targetCurrency) => {
  const rates = await fetchExchangeRates();
  const rate = rates[targetCurrency];
  if (!rate) {
    throw new Error(`Unsupported currency: ${targetCurrency}`);
  }
  return rate;
};
