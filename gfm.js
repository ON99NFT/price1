// Function to fetch MEXC bid-ask prices for GFM
async function fetchMexcPrice() {
    try {
      const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
      const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/GFM_USDT';
      const response = await fetch(proxyUrl + apiUrl);
      const data = await response.json();
  
      if (!data || !data.data || !data.data.bids || !data.data.asks) {
        throw new Error('Invalid MEXC API response');
      }
  
      // Extract the best bid and ask prices
      const bestBid = parseFloat(data.data.bids[0][0]); // Highest bid price
      const bestAsk = parseFloat(data.data.asks[0][0]); // Lowest ask price
  
      return { bid: bestBid, ask: bestAsk };
    } catch (error) {
      console.error('Error fetching MEXC bid-ask prices:', error);
      return null;
    }
  }
  
  // Function to fetch JUP price for a given swap
  async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
    try {
      const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
      const response = await fetch(url);
  
      if (!response.ok) {
        throw new Error(`JUP API error: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
      return data.outAmount / 10 ** decimals; // Convert lamports to token amount
    } catch (error) {
      console.error('Error fetching JUP swap price:', error);
      return null;
    }
  }
  
  // Function to fetch JUP prices for GFM
  async function fetchJupPrice() {
    const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint address
    const outputMintGFM = 'E1jCTXdkMRoawoWoqfbhiNkkLbxcSHPssMo36U84pump'; // GFM mint address
  
// In fetchJupPrice() function, adjust swap amounts:
const [gfmAmountFor300USDC, usdcAmountFor5000GFM] = await Promise.all([
    fetchJupSwapPrice(inputMintUSDC, outputMintGFM, 300 * 1e6, 6), // Change 9 to 6
    fetchJupSwapPrice(outputMintGFM, inputMintUSDC, 5000 * 1e6, 6), // Change 1e9 to 1e6
  ]);
  
    if (gfmAmountFor300USDC === null || usdcAmountFor5000GFM === null) {
      return null;
    }
  
    // Calculate rates
    const jupRateFor300USDC = 300 / gfmAmountFor300USDC; // Price per GFM
    const jupRateFor5000GFM = usdcAmountFor5000GFM / 5000; // Price per GFM
  
    return {
      rateFor300USDC: jupRateFor300USDC,
      rateFor5000GFM: jupRateFor5000GFM,
    };
  }
  
  // Function to update alerts
  async function updateAlerts() {
    const buyAlertElement = document.getElementById('buy-alert');
    const sellAlertElement = document.getElementById('sell-alert');
  
    const mexcPrices = await fetchMexcPrice();
    const jupPrices = await fetchJupPrice();
  
    if (mexcPrices !== null && jupPrices !== null) {
      // Calculate Buy Alert (MEXC Bid vs JUP Rate for 300 USDC)
      const buyDifference = mexcPrices.bid - jupPrices.rateFor300USDC;
      buyAlertElement.textContent = buyDifference.toFixed(5);
      applyAlertStyles(buyAlertElement, buyDifference);
  
      // Calculate Sell Alert (JUP Rate for 5000 GFM vs MEXC Ask)
      const sellDifference = jupPrices.rateFor5000GFM - mexcPrices.ask;
      sellAlertElement.textContent = sellDifference.toFixed(5);
      applyAlertStyles(sellAlertElement, sellDifference);
    } else {
      buyAlertElement.textContent = 'Error';
      sellAlertElement.textContent = 'Error';
      console.error('Failed to update alerts.');
    }
  }
  
  // Function to apply styles based on the alert difference
  function applyAlertStyles(element, difference) {
    // Reset classes and inline styles
    element.classList.remove(
      'alert-positive',
      'alert-negative',
      'alert-flashing-1',
      'alert-flashing-2',
      'alert-flashing-negative-1',
      'alert-flashing-negative-2',
      'alert-large',
      'alert-large-green',
      'alert-large-red'
    );
    element.style.fontSize = ''; // Reset font size
    element.style.backgroundColor = ''; // Reset background color
    element.style.color = ''; // Reset text color
  
    // Apply styles based on the difference
    if (difference > 0.003) {
      element.style.fontSize = '4em'; // 4x bigger font size
      element.classList.add('alert-flashing-2'); // Faster flashing
    } else if (difference > 0.002) {
      element.style.fontSize = '2em'; // 2x bigger font size
      element.classList.add('alert-flashing-1'); // Slower flashing
    } else if (difference > 0.001) {
      element.style.fontSize = '2em'; // 2x bigger font size
      element.classList.add('alert-large', 'alert-large-green'); // Green background with white text
    } else if (difference > 0) {
      element.classList.add('alert-positive');
    } else if (difference < -0.003) {
      element.style.fontSize = '4em'; // 4x bigger font size
      element.classList.add('alert-flashing-negative-2'); // Faster flashing (red)
    } else if (difference < -0.002) {
      element.style.fontSize = '2em'; // 2x bigger font size
      element.classList.add('alert-flashing-negative-1'); // Slower flashing (red)
    } else if (difference < -0.001) {
      element.style.fontSize = '2em'; // 2x bigger font size
      element.classList.add('alert-large', 'alert-large-red'); // Red background with white text
    } else if (difference < 0) {
      element.classList.add('alert-negative');
    }
  }
  
  // Update alerts every 5 seconds
  async function updatePrices() {
    await updateAlerts();
  }
  
  // Initial call to display alerts immediately
  updatePrices();
  
  // Update alerts every 5 seconds
  setInterval(updatePrices, 5000);