// Function to fetch MEXC bid-ask prices for VVV_USDT
async function fetchMexcPrice() {
    try {
      const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
      const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/VVV_USDT';
      const response = await fetch(proxyUrl + apiUrl);
      const data = await response.json();
  
      if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
        throw new Error('Invalid MEXC API response');
      }
  
      return {
        bid: parseFloat(data.data.bids[0][0]),
        ask: parseFloat(data.data.asks[0][0])
      };
    } catch (error) {
      console.error('MEXC Error:', error);
      return null;
    }
  }
  
  // Function to fetch KyberSwap price
  async function fetchKyberSwapPrice(inputToken, outputToken, amount) {
    try {
      const amountIn = amount.toLocaleString('fullwide', { useGrouping: false });
      const url = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${inputToken}&tokenOut=${outputToken}&amountIn=${amountIn}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API ${response.status}: ${errorData?.message || 'Unknown error'}`);
      }
  
      const data = await response.json();
      // Updated response structure handling
      return data.data?.routeSummary?.amountOut || data.data?.outAmount;
    } catch (error) {
      console.error('KyberSwap Error:', error);
      return null;
    }
  }
  
  // Main price calculation function
  // Function to fetch KyberSwap prices for VVV
async function fetchKyberPrice() {
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
    const VVV_ADDRESS = '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf'; // VVV Contract
  
    try {
      const [vvvAmount, usdcAmount] = await Promise.all([
        // Changed to 900 USDC -> VVV
        fetchKyberSwapPrice(USDC_ADDRESS, VVV_ADDRESS, 900 * 1e6), 
        // Changed to 100 VVV -> USDC
        fetchKyberSwapPrice(VVV_ADDRESS, USDC_ADDRESS, 100 * 1e18) 
      ]);
  
      if (!vvvAmount || !usdcAmount) return null;
  
      return {
        // Updated calculation for 900 USDC
        buyPrice: 900 / (vvvAmount / 1e18), // USDC per VVV
        // Updated calculation for 100 VVV
        sellPrice: (usdcAmount / 1e6) / 100 // USDC per VVV
      };
    } catch (error) {
      console.error('Price Calculation Error:', error);
      return null;
    }
  }
  
  // Alert update function
  async function updateAlerts() {
    const buyAlert = document.getElementById('buy-alert');
    const sellAlert = document.getElementById('sell-alert');
  
    try {
      const [mexcData, kyberData] = await Promise.all([
        fetchMexcPrice(),
        fetchKyberPrice()
      ]);
  
      if (!mexcData || !kyberData) {
        buyAlert.textContent = sellAlert.textContent = 'Error';
        return;
      }
  
      // Calculate differences
      const buyDifference = (mexcData.bid - kyberData.buyPrice).toFixed(5);
      const sellDifference = (kyberData.sellPrice - mexcData.ask).toFixed(5);
  
      // Update displays
      buyAlert.textContent = buyDifference;
      sellAlert.textContent = sellDifference;
      
      // Apply styles
      applyAlertStyles(buyAlert, parseFloat(buyDifference));
      applyAlertStyles(sellAlert, parseFloat(sellDifference));
      
    } catch (error) {
      console.error('Update Error:', error);
      buyAlert.textContent = sellAlert.textContent = 'Error';
    }
  }
  
  // Style application function
  function applyAlertStyles(element, value) {
    element.className = ''; // Reset classes
    if (value > 0.3) {
      element.classList.add('alert-flashing-2');
    } else if (value > 0.2) {
      element.classList.add('alert-flashing-1');
    } else if (value > 0.1) {
      element.classList.add('alert-large-green');
    } else if (value > 0) {
      element.classList.add('alert-positive');
    } else if (value < -0.3) {
      element.classList.add('alert-flashing-negative-2');
    } else if (value < -0.2) {
      element.classList.add('alert-flashing-negative-1');
    } else if (value < -0.1) {
      element.classList.add('alert-large-red');
    } else {
      element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
    }
  }
  
  // Initialize and update every 5 seconds
  (function init() {
    updateAlerts();
    setInterval(updateAlerts, 5000);
  })();