    // javascript logic...
        /**
         * NUMERA CALCULATOR - CORE APPLICATION LOGIC
         * Architecture: Vanilla JS + DOM Manipulation + LocalStorage
         */

        document.addEventListener('DOMContentLoaded', () => {
            
            // --- UI Elements ---
            const splash = document.getElementById('splash');
            const displayMain = document.getElementById('display-main');
            const displayExpr = document.getElementById('display-expr');
            const buttons = document.querySelectorAll('.calc-btn');
            const sciPanel = document.getElementById('sci-panel');
            const toggleSciBtn = document.getElementById('toggle-sci');
            const historyPanel = document.getElementById('history-panel');
            const sidebarOverlay = document.getElementById('sidebar-overlay');
            const toggleHistoryBtns = [document.getElementById('toggle-history'), document.getElementById('toggle-history-nav')];
            const closeHistoryBtn = document.getElementById('close-history');
            const historyList = document.getElementById('history-list');
            const clearHistoryBtn = document.getElementById('clear-history');
            const themeBtns = document.querySelectorAll('[data-set-theme]');
            const toggleSoundBtn = document.getElementById('toggle-sound');
            const degRadBtn = document.getElementById('deg-rad-btn');
            const copyBtn = document.getElementById('copy-btn');
            const customCursor = document.getElementById('custom-cursor');

            // --- State Variables ---
            let expression = '';        // Raw expression string
            let evaluatedResult = '';   // Final evaluated result string
            let isEvaluated = false;    // Flag to check if display shows a final result
            let history = JSON.parse(localStorage.getItem('numera_history')) || [];
            let isDeg = true;           // True for Degrees, False for Radians
            let soundEnabled = JSON.parse(localStorage.getItem('numera_sound')) ?? true;
            let openBrackets = 0;       // Track brackets for the smart () button

            // --- Audio Context for Premium Haptic/Sound Feedback ---
            let audioCtx = null;
            function initAudio() {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
            }

            function playClickSound(type = 'normal') {
                if (!soundEnabled) return;
                initAudio();
                if(audioCtx.state === 'suspended') audioCtx.resume();

                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                if (type === 'action') {
                    oscillator.type = 'triangle';
                    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);
                    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                } else {
                    // Normal click
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
                    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                }
                
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
                
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.05);
                
                // Haptic feedback for mobile
                if (navigator.vibrate) {
                    navigator.vibrate(type === 'action' ? 15 : 5);
                }
            }

            // --- Splash Screen & Init ---
            setTimeout(() => {
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 800);
            }, 1000);

            // Set initial states based on localStorage
            updateSoundIcon();
            renderHistory();
            const savedTheme = localStorage.getItem('numera_theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);

            // --- Custom Cursor Logic ---
            document.addEventListener('mousemove', (e) => {
                customCursor.style.left = e.clientX + 'px';
                customCursor.style.top = e.clientY + 'px';
            });
            document.querySelectorAll('button, a, .cursor-pointer').forEach(el => {
                el.addEventListener('mouseenter', () => customCursor.classList.add('hovering'));
                el.addEventListener('mouseleave', () => customCursor.classList.remove('hovering'));
            });

            // --- Background Particles ---
            function createParticles() {
                const container = document.getElementById('particles-container');
                for(let i=0; i<15; i++) {
                    let particle = document.createElement('div');
                    particle.classList.add('particle');
                    let size = Math.random() * 8 + 2;
                    particle.style.width = size + 'px';
                    particle.style.height = size + 'px';
                    particle.style.left = Math.random() * 100 + 'vw';
                    particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
                    particle.style.animationDelay = (Math.random() * 5) + 's';
                    container.appendChild(particle);
                }
            }
            createParticles();

            // --- Calculator Engine ---
            
            // Format number to handle precision and commas
            function formatNumber(num) {
                if (num === 'Error' || num === 'NaN' || num === 'Infinity') return 'Error';
                let str = num.toString();
                if (str.length > 12) {
                    // Convert to scientific notation if too large
                    if (Math.abs(num) > 1e12 || Math.abs(num) < 1e-7) {
                        return num.toExponential(6).replace('+', '');
                    }
                    // Round long decimals
                    return parseFloat(num.toFixed(10)).toString();
                }
                // Add commas for thousands (only integer part)
                let parts = str.split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                return parts.join('.');
            }

            // Safe Math Evaluator using Function constructor with custom scope
            function evaluateMath(expr) {
                if (!expr) return '';
                try {
                    // Sanitize input: Replace display symbols with code operators
                    let parsed = expr.replace(/×/g, '*').replace(/÷/g, '/');
                    
                    // Replace percentages
                    parsed = parsed.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
                    
                    // Scope functions mapping for Function constructor
                    const scope = {
                        sin: (x) => isDeg ? Math.sin(x * Math.PI / 180) : Math.sin(x),
                        cos: (x) => isDeg ? Math.cos(x * Math.PI / 180) : Math.cos(x),
                        tan: (x) => {
                            let val = isDeg ? Math.tan(x * Math.PI / 180) : Math.tan(x);
                            // Handle asymptotic infinity for tan(90)
                            return Math.abs(val) > 1e10 ? 'Error' : val;
                        },
                        asin: (x) => isDeg ? Math.asin(x) * 180 / Math.PI : Math.asin(x),
                        acos: (x) => isDeg ? Math.acos(x) * 180 / Math.PI : Math.acos(x),
                        atan: (x) => isDeg ? Math.atan(x) * 180 / Math.PI : Math.atan(x),
                        log: Math.log10,
                        ln: Math.log,
                        sqrt: Math.sqrt,
                        abs: Math.abs,
                        fact: function(n) {
                            if (n < 0) return 'Error';
                            if (n === 0 || n === 1) return 1;
                            if (n > 170) return Infinity; // Max safe factorial
                            let res = 1;
                            for (let i = 2; i <= Math.floor(n); i++) res *= i;
                            return res;
                        },
                        PI: Math.PI,
                        E: Math.E
                    };

                    // Replace constants
                    parsed = parsed.replace(/π/g, 'scope.PI').replace(/e/g, 'scope.E');
                    
                    // Replace functions
                    const funcs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'abs'];
                    funcs.forEach(f => {
                        let reg = new RegExp(f + '\\(', 'g');
                        parsed = parsed.replace(reg, `scope.${f}(`);
                    });

                    // Replace root symbol '√(' -> 'scope.sqrt('
                    parsed = parsed.replace(/√\(/g, 'scope.sqrt(');

                    // Replace factorial eg. '5!' -> 'scope.fact(5)'
                    // Handles numbers, decimals, and closing brackets before the !
                    let factReg = /((?:\d+\.?\d*)|(?:\([^)]+\)))!/g;
                    while (factReg.test(parsed)) {
                        parsed = parsed.replace(factReg, 'scope.fact($1)');
                    }

                    // Handle powers '2^3' -> '(2)**(3)'
                    // A simple replacement is naive. Real calculators need proper parsing.
                    // For JS eval, ^ needs to be replaced with **. 
                    parsed = parsed.replace(/\^/g, '**');

                    // Add implicit multiplication 
                    // e.g. 2(3) -> 2*(3)
                    parsed = parsed.replace(/(\d)(\()/g, '$1*(');
                    // e.g. 2π -> 2*scope.PI
                    parsed = parsed.replace(/(\d)(scope\.PI|scope\.E)/g, '$1*$2');
                    parsed = parsed.replace(/(\))(scope\.PI|scope\.E)/g, '$1*$2');

                    // Close any unclosed brackets for evaluation
                    let openCount = (parsed.match(/\(/g) || []).length;
                    let closeCount = (parsed.match(/\)/g) || []).length;
                    for (let i = 0; i < openCount - closeCount; i++) {
                        parsed += ')';
                    }

                    // Evaluate using strict function scope
                    let result = new Function('scope', `return ${parsed}`)(scope);
                    
                    if (typeof result === 'number') {
                        if (!isFinite(result) || isNaN(result)) return 'Error';
                        // Fix JS floating point issues e.g. 0.1 + 0.2
                        return parseFloat(result.toPrecision(14)); 
                    }
                    return result;

                } catch (err) {
                    return ''; // Silently fail for live preview
                }
            }

            // Update UI displays
            function updateDisplay() {
                if (expression === '') {
                    displayMain.innerText = '0';
                    displayExpr.innerText = '';
                    return;
                }
                
                // Format expression for viewing (add spaces around operators)
                let viewExpr = expression.replace(/([+×÷-])/g, ' $1 ');
                
                if (isEvaluated) {
                    displayExpr.innerText = viewExpr + ' =';
                    displayMain.innerText = formatNumber(evaluatedResult);
                    displayMain.classList.add('text-[var(--accent)]');
                } else {
                    displayExpr.innerText = viewExpr;
                    displayMain.innerText = expression;
                    displayMain.classList.remove('text-[var(--accent)]');
                    
                    // Live Preview
                    let live = evaluateMath(expression);
                    if (live !== '' && live !== 'Error') {
                        // Show subtle preview
                        displayMain.innerText = formatNumber(live);
                        displayMain.style.opacity = '0.7';
                    } else {
                        displayMain.innerText = expression;
                        displayMain.style.opacity = '1';
                    }
                }
                
                // Auto scroll to end
                displayMain.scrollLeft = displayMain.scrollWidth;
                displayExpr.scrollLeft = displayExpr.scrollWidth;
            }

            // Add Ripple Effect to Buttons
            function createRipple(e, btn) {
                const circle = document.createElement('span');
                const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                const radius = diameter / 2;
                const rect = btn.getBoundingClientRect();
                
                // Support keyboard trigger (e.clientX is undefined)
                const clientX = e.clientX || rect.left + radius;
                const clientY = e.clientY || rect.top + radius;

                circle.style.width = circle.style.height = `${diameter}px`;
                circle.style.left = `${clientX - rect.left - radius}px`;
                circle.style.top = `${clientY - rect.top - radius}px`;
                circle.classList.add('ripple');
                
                const existingRipple = btn.querySelector('.ripple');
                if (existingRipple) existingRipple.remove();
                
                btn.appendChild(circle);
            }

            function showToast(message) {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = 'glass-panel bg-[var(--accent)] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-slide-up';
                toast.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${message}`;
                container.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 2000);
            }

            // --- Core Input Handler ---
            function handleInput(action, val) {
                // If starting new calculation after equals
                if (isEvaluated && action !== 'calculate') {
                    if (action === 'insert' && !isNaN(val)) {
                        expression = ''; // start fresh if typing number
                    } else {
                        // continue with previous result
                        expression = evaluatedResult === 'Error' ? '' : evaluatedResult.toString();
                    }
                    isEvaluated = false;
                    displayMain.style.opacity = '1';
                }

                switch (action) {
                    case 'insert':
                        // Prevent multiple decimals in one number
                        if (val === '.') {
                            const lastNum = expression.split(/[-+×÷\(\)]/).pop();
                            if (lastNum.includes('.')) break;
                        }
                        // Prevent operators at the very beginning (except minus)
                        if (['+', '×', '÷', '^'].includes(val) && expression === '') break;
                        
                        // Replace last operator if multiple typed
                        if (['+', '-', '×', '÷'].includes(val)) {
                            let lastChar = expression.slice(-1);
                            if (['+', '-', '×', '÷'].includes(lastChar)) {
                                expression = expression.slice(0, -1) + val;
                                break;
                            }
                        }
                        expression += val;
                        break;
                        
                    case 'func':
                        expression += val + '(';
                        openBrackets++;
                        break;

                    case 'bracket':
                        let openCount = (expression.match(/\(/g) || []).length;
                        let closeCount = (expression.match(/\)/g) || []).length;
                        // Insert closing if we have unclosed opens, and last char isn't an open bracket or operator
                        let last = expression.slice(-1);
                        if (openCount > closeCount && !['+', '-', '×', '÷', '('].includes(last) && expression !== '') {
                            expression += ')';
                        } else {
                            expression += '(';
                            // Add implicit multiplier if previous char is number
                            if (/\d|\)/.test(last)) {
                                expression = expression.slice(0, -1) + '×(';
                            }
                        }
                        break;

                    case 'delete':
                        expression = expression.slice(0, -1);
                        break;

                    case 'clear':
                        expression = '';
                        evaluatedResult = '';
                        isEvaluated = false;
                        displayMain.style.opacity = '1';
                        break;

                    case 'calculate':
                        if (expression === '') return;
                        
                        let res = evaluateMath(expression);
                        if (res !== '') {
                            evaluatedResult = res;
                            isEvaluated = true;
                            displayMain.style.opacity = '1';
                            
                            // Save to History
                            if (res !== 'Error') {
                                saveToHistory(expression, res);
                            }
                        } else {
                            evaluatedResult = 'Error';
                            isEvaluated = true;
                        }
                        break;

                    case 'toggle-deg':
                        isDeg = !isDeg;
                        degRadBtn.innerText = isDeg ? 'DEG' : 'RAD';
                        degRadBtn.classList.toggle('text-[var(--accent)]');
                        break;
                }
                
                updateDisplay();
            }

            // Bind UI Buttons
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = btn.getAttribute('data-action');
                    const val = btn.getAttribute('data-val');
                    
                    // Visuals & Sound
                    createRipple(e, btn);
                    playClickSound(['calculate', 'clear'].includes(action) ? 'action' : 'normal');
                    
                    handleInput(action, val);
                });
            });

            // --- Keyboard Support ---
            const keyMap = {
                '0': {action: 'insert', val: '0'}, '1': {action: 'insert', val: '1'}, '2': {action: 'insert', val: '2'},
                '3': {action: 'insert', val: '3'}, '4': {action: 'insert', val: '4'}, '5': {action: 'insert', val: '5'},
                '6': {action: 'insert', val: '6'}, '7': {action: 'insert', val: '7'}, '8': {action: 'insert', val: '8'},
                '9': {action: 'insert', val: '9'}, '.': {action: 'insert', val: '.'},
                '+': {action: 'insert', val: '+'}, '-': {action: 'insert', val: '-'},
                '*': {action: 'insert', val: '×'}, '/': {action: 'insert', val: '÷'},
                '%': {action: 'insert', val: '%'}, '^': {action: 'insert', val: '^'},
                '(': {action: 'insert', val: '('}, ')': {action: 'insert', val: ')'},
                'Enter': {action: 'calculate'}, '=': {action: 'calculate'},
                'Backspace': {action: 'delete'}, 'Escape': {action: 'clear'}
            };

            document.addEventListener('keydown', (e) => {
                const mapped = keyMap[e.key];
                if (mapped) {
                    e.preventDefault();
                    
                    // Find corresponding button to animate
                    let targetBtn = null;
                    if (mapped.action === 'calculate') targetBtn = document.querySelector('[data-action="calculate"]');
                    else if (mapped.action === 'clear') targetBtn = document.querySelector('[data-action="clear"]');
                    else if (mapped.action === 'delete') targetBtn = document.querySelector('[data-action="delete"]');
                    else targetBtn = document.querySelector(`[data-val="${mapped.val}"]`);
                    
                    if (targetBtn) {
                        targetBtn.classList.add('pressed');
                        setTimeout(() => targetBtn.classList.remove('pressed'), 100);
                        createRipple({ clientX: 0, clientY: 0 }, targetBtn); // Trigger ripple from center
                    }

                    playClickSound(['calculate', 'clear'].includes(mapped.action) ? 'action' : 'normal');
                    handleInput(mapped.action, mapped.val);
                }
            });

            // --- Sidebar & Panels ---
            toggleSciBtn.addEventListener('click', () => {
                sciPanel.classList.toggle('open');
                playClickSound('action');
                toggleSciBtn.classList.toggle('bg-[var(--btn-hover)]');
                toggleSciBtn.classList.toggle('text-[var(--accent)]');
            });

            function toggleHistory() {
                historyPanel.classList.toggle('open');
                if (historyPanel.classList.contains('open')) {
                    sidebarOverlay.classList.remove('hidden');
                    setTimeout(() => sidebarOverlay.classList.add('opacity-100'), 10);
                } else {
                    sidebarOverlay.classList.remove('opacity-100');
                    setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
                }
            }

            toggleHistoryBtns.forEach(btn => btn.addEventListener('click', toggleHistory));
            closeHistoryBtn.addEventListener('click', toggleHistory);
            sidebarOverlay.addEventListener('click', toggleHistory);

            // --- History Logic ---
            function saveToHistory(expr, res) {
                // Prevent duplicate consecutive entries
                if (history.length > 0 && history[0].expr === expr) return;
                
                history.unshift({ expr: expr, res: res, date: new Date().toISOString() });
                if (history.length > 20) history.pop(); // Keep last 20
                localStorage.setItem('numera_history', JSON.stringify(history));
                renderHistory();
            }

            function renderHistory() {
                historyList.innerHTML = '';
                if (history.length === 0) {
                    historyList.innerHTML = '<div class="text-center text-[var(--text-muted)] mt-10 text-sm font-light">No calculations yet.</div>';
                    return;
                }
                
                history.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'glass-panel p-3 rounded-xl cursor-pointer hover:bg-[var(--btn-hover)] transition-all group animate-fade-in text-right';
                    div.style.animationDelay = `${index * 0.05}s`;
                    
                    let formattedExpr = item.expr.replace(/([+×÷-])/g, ' $1 ');
                    
                    div.innerHTML = `
                        <div class="text-xs text-[var(--text-muted)] mb-1 font-mono">${formattedExpr} =</div>
                        <div class="text-lg font-mono font-medium group-hover:text-[var(--accent)] transition-colors">${formatNumber(item.res)}</div>
                    `;
                    
                    div.addEventListener('click', () => {
                        // Restore calculation
                        expression = item.expr;
                        evaluatedResult = item.res;
                        isEvaluated = true;
                        updateDisplay();
                        toggleHistory(); // Close sidebar
                    });
                    
                    historyList.appendChild(div);
                });
            }

            clearHistoryBtn.addEventListener('click', () => {
                history = [];
                localStorage.removeItem('numera_history');
                renderHistory();
            });

            // --- Tools ---
            copyBtn.addEventListener('click', () => {
                const textToCopy = isEvaluated ? evaluatedResult.toString() : expression;
                if (!textToCopy) return;
                
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Copied to clipboard');
                    copyBtn.innerHTML = '<i class="fas fa-check text-green-400 text-sm"></i>';
                    setTimeout(() => copyBtn.innerHTML = '<i class="far fa-copy text-sm"></i>', 2000);
                });
            });

            // --- Theme & Sound Toggles ---
            themeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const theme = btn.getAttribute('data-set-theme');
                    document.documentElement.setAttribute('data-theme', theme);
                    localStorage.setItem('numera_theme', theme);
                    showToast(`Theme updated: ${theme}`);
                });
            });

            function updateSoundIcon() {
                toggleSoundBtn.innerHTML = soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
                toggleSoundBtn.classList.toggle('text-[var(--accent)]', soundEnabled);
            }

            toggleSoundBtn.addEventListener('click', () => {
                soundEnabled = !soundEnabled;
                localStorage.setItem('numera_sound', JSON.stringify(soundEnabled));
                updateSoundIcon();
                if(soundEnabled) playClickSound('normal');
                showToast(soundEnabled ? 'Sound Enabled' : 'Sound Muted');
            });

            // --- Scroll Animations ---
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('opacity-100', 'translate-y-0');
                        entry.target.classList.remove('opacity-0', 'translate-y-8');
                    }
                });
            }, { threshold: 0.1 });

            // Navbar Glass Effect on Scroll
            window.addEventListener('scroll', () => {
                const nav = document.getElementById('navbar');
                if (window.scrollY > 20) {
                    nav.classList.add('shadow-lg');
                } else {
                    nav.classList.remove('shadow-lg');
                }
            });
        });