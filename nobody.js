const nobody = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;

    // Audio initialization
    function handleAudioInitialization() {
        enableButton = document.createElement('button');
        enableButton.id = 'nobody-audio-enable-btn';
        enableButton.innerHTML = '🔇 Enable Alert Sounds';
        enableButton.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        `;

        enableButton.addEventListener('mouseover', () => {
            enableButton.style.transform = 'scale(1.03)';
            enableButton.style.background = '#45a049';
        });
        
        enableButton.addEventListener('mouseout', () => {
            enableButton.style.transform = 'scale(1)';
            enableButton.style.background = '#4CAF50';
        });

        enableButton.addEventListener('click', async () => {
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                audioEnabled = true;
                enableButton.innerHTML = '🔊 Sounds Enabled!';
                setTimeout(() => {
                    enableButton.style.opacity = '0';
                    setTimeout(() => enableButton.remove(), 300);
                }, 1500);
            } catch (error) {
                console.error('Audio initialization failed:', error);
                enableButton.innerHTML = '❌ Error';
                enableButton.style.background = '#f44336';
            }
        });

        const section = document.getElementById('nobody-buy-alert').closest('.token-section');
        section.appendChild(enableButton);
    }

    // Sound alert function
    function playAlertSound() {
        if (!audioEnabled || !audioContext) return;

        try {
            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            osc.start();
            osc.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Sound playback error:', error);
        }
    }

    // JUP swap function
    async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
        try {
            const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
            const response = await fetch(url);
        
            if (!response.ok) {
                throw new Error(`JUP API error: ${response.status}`);
            }
        
            const data = await response.json();
            return data.outAmount / 10 ** decimals;
        } catch (error) {
            console.error('Error fetching JUP swap price:', error);
            return null;
        }
    }

    // MEXC price fetch
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/NOBODY_USDT';
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
        
            if (!data?.data?.bids?.[0]?.[0]) throw new Error('Invalid MEXC response');
            
            return {
                bid: parseFloat(data.data.bids[0][0]),
                ask: parseFloat(data.data.asks[0][0])
            };
        } catch (error) {
            console.error('MEXC Error:', error);
            return null;
        }
    }

    // JUP price calculation
    async function fetchJupPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintnobody = 'C29ebrgYjYoJPMGPnPSGY1q3mMGk4iDSqnQeQQA7moon';
    
        const [nobodyAmount, usdcAmount] = await Promise.all([
            fetchJupSwapPrice(inputMintUSDC, outputMintnobody, 498 * 1e6, 9),
            fetchJupSwapPrice(outputMintnobody, inputMintUSDC, 16998 * 1e9, 6)
        ]);
    
        if (!nobodyAmount || !usdcAmount) return null;
    
        return {
            rateFor500USDC: 498 / nobodyAmount,
            rateFor4500nobody: usdcAmount / 16998
        };
    }

    // Alert update
    async function updateAlerts() {
        const buyElement = document.getElementById('nobody-buy-alert');
        const sellElement = document.getElementById('nobody-sell-alert');
    
        try {
            const [mexcData, jupData] = await Promise.all([
                fetchMexcPrice(),
                fetchJupPrice()
            ]);
    
            if (!mexcData || !jupData) {
                buyElement.textContent = sellElement.textContent = 'Error';
                return;
            }
    
            const buyDiff = (mexcData.bid - jupData.rateFor500USDC).toFixed(5);
            const sellDiff = (jupData.rateFor4500nobody - mexcData.ask).toFixed(5);
    
            buyElement.textContent = buyDiff;
            sellElement.textContent = sellDiff;
    
            applyAlertStyles(buyElement, parseFloat(buyDiff));
            applyAlertStyles(sellElement, parseFloat(sellDiff));
        } catch (error) {
            console.error('Update error:', error);
            buyElement.textContent = sellElement.textContent = 'Error';
        }
    }

    // Alert styling
    function applyAlertStyles(element, difference) {
        element.classList.remove(
            'alert-positive', 'alert-negative',
            'alert-flashing-1', 'alert-flashing-2',
            'alert-large-green'
        );
        element.style.fontSize = '';
        
        let playSound = false;
        if (difference > 0.001) {
            element.classList.add('alert-flashing-2');
            playSound = true;
        } else if (difference > 0.0005) {
            element.classList.add('alert-flashing-1');
            playSound = true;
        } else if (difference > 0.00025) {
            element.classList.add('alert-large-green');
        } else if (difference > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add('alert-negative');
        }

        if (playSound && audioEnabled && element.id === 'nobody-buy-alert') {
            playAlertSound();
        }
    }

    // Initialization
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 9900);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();

    return { updateAlerts };
})();