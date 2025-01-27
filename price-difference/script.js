// Function to fetch MEXC bid-ask prices
async function fetchMexcPrice() {
  try {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/PASTERNAK_USDT';
    const response = await fetch(proxyUrl + apiUrl);
    const data = await response.json();

    if (!data || !data.data || !data.data.bids || !data.data.asks) {
      throw new Error('Invalid MEXC API response');
    }

    // Extract the best bid and ask prices
    const bestBid = parseFloat(data.data.bids[0][0]); // Highest bid price
    const bestAsk = parseFloat(data.data.asks[0][0]); // Lowest ask price

    console.log('MEXC Bid Price:', bestBid); // Log the bid price
    console.log('MEXC Ask Price:', bestAsk); // Log the ask price

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

// Function to fetch JUP prices
async function fetchJupPrice() {
  const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint address
  const outputMintPasternak = 'Ey59PH7Z4BFU4HjyKnyMdWt5GGN76KazTAwQihoUXRnk'; // Pasternak mint address

  // Fetch rates concurrently
  const [pasternakAmountFor300USDC, usdcAmountFor9000Pasternak] = await Promise.all([
    fetchJupSwapPrice(inputMintUSDC, outputMintPasternak, 300 * 1e6, 9), // 300 USDC to Pasternak
    fetchJupSwapPrice(outputMintPasternak, inputMintUSDC, 9000 * 1e9, 6), // 9000 Pasternak to USDC
  ]);

  if (pasternakAmountFor300USDC === null || usdcAmountFor9000Pasternak === null) {
    return null;
  }

  // Calculate rates
  const jupRateFor300USDC = 300 / pasternakAmountFor300USDC; // Price per Pasternak
  const jupRateFor9000Pasternak = usdcAmountFor9000Pasternak / 9000; // Price per Pasternak

  return {
    rateFor300USDC: jupRateFor300USDC,
    rateFor9000Pasternak: jupRateFor9000Pasternak,
  };
}

// Function to update MEXC prices
async function updateMexcPrices() {
  const mexcBidElement = document.getElementById('mexc-bid');
  const mexcAskElement = document.getElementById('mexc-ask');

  const mexcPrices = await fetchMexcPrice();

  if (mexcPrices !== null) {
    // Display MEXC bid and ask prices
    mexcBidElement.textContent = mexcPrices.bid.toFixed(5);
    mexcAskElement.textContent = mexcPrices.ask.toFixed(5);
  } else {
    mexcBidElement.textContent = 'Error';
    mexcAskElement.textContent = 'Error';
    console.error('Failed to update MEXC prices.');
  }
}

// Function to update JUP prices and calculate differences
async function updateJupPrices() {
  const jupRateFor300USDCElement = document.getElementById('jup-rate-300-usdc');
  const priceDifferenceFor300USDCElement = document.getElementById('price-difference-300-usdc');
  const jupRateFor9000PasternakElement = document.getElementById('jup-rate-9000-pasternak');
  const priceDifferenceFor9000PasternakElement = document.getElementById('price-difference-9000-pasternak');

  const jupPrices = await fetchJupPrice();
  const mexcBid = parseFloat(document.getElementById('mexc-bid').textContent);
  const mexcAsk = parseFloat(document.getElementById('mexc-ask').textContent);

  if (jupPrices !== null && !isNaN(mexcBid) && !isNaN(mexcAsk)) {
    // Display JUP rate for 300 USDC to Pasternak
    jupRateFor300USDCElement.textContent = jupPrices.rateFor300USDC.toFixed(5);

    // Calculate and display price difference for 300 USDC to Pasternak
    const differenceFor300USDC = mexcBid - jupPrices.rateFor300USDC;
    priceDifferenceFor300USDCElement.textContent = differenceFor300USDC.toFixed(5);
    applyDifferenceStyles(priceDifferenceFor300USDCElement, differenceFor300USDC);

    // Display JUP rate for 9000 Pasternak to USDC
    jupRateFor9000PasternakElement.textContent = jupPrices.rateFor9000Pasternak.toFixed(5);

    // Calculate and display price difference for 9000 Pasternak to USDC
    const differenceFor9000Pasternak = jupPrices.rateFor9000Pasternak - mexcAsk;
    priceDifferenceFor9000PasternakElement.textContent = differenceFor9000Pasternak.toFixed(5);
    applyDifferenceStyles(priceDifferenceFor9000PasternakElement, differenceFor9000Pasternak);
  } else {
    jupRateFor300USDCElement.textContent = 'Error';
    priceDifferenceFor300USDCElement.textContent = 'Error';
    jupRateFor9000PasternakElement.textContent = 'Error';
    priceDifferenceFor9000PasternakElement.textContent = 'Error';
    console.error('Failed to update JUP prices.');
  }
}

// Function to apply styles based on the price difference
function applyDifferenceStyles(element, difference) {
  // Reset classes
  element.classList.remove('difference-positive', 'difference-negative');

  // Apply styles based on the difference
  if (difference > 0) {
    element.classList.add('difference-positive');
  } else if (difference < 0) {
    element.classList.add('difference-negative');
  }
}

// Update prices every 3 seconds
async function updatePrices() {
  await updateMexcPrices();
  await updateJupPrices();
}

// Initial calls to display prices immediately
updatePrices();

// Update prices every 3 seconds
setInterval(updatePrices, 3000);