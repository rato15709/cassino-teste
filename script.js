// Initialize User Manager
const userManager = new UserManager();

// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Slot Machine Game Logic
class SlotMachine {
    constructor(userManager) {
        this.userManager = userManager;
        this.symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣'];
        this.betAmount = 10;
        this.isSpinning = false;
        
        this.reel1 = document.getElementById('reel1');
        this.reel2 = document.getElementById('reel2');
        this.reel3 = document.getElementById('reel3');
        this.balanceDisplay = document.getElementById('balance');
        this.betInput = document.getElementById('bet-amount');
        this.spinButton = document.getElementById('spin-button');
        this.winMessage = document.getElementById('win-message');
        
        this.initializeEventListeners();
        this.updateDisplay();
    }
    
    initializeEventListeners() {
        this.spinButton.addEventListener('click', () => this.spin());
        
        this.betInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0 && value <= this.userManager.currentUser.balance && value <= 100) {
                this.betAmount = value;
            } else {
                e.target.value = this.betAmount;
            }
        });
    }
    
    spin() {
        if (this.isSpinning) return;
        
        if (!this.userManager.currentUser) {
            this.showMessage('Faça login para jogar!', 'error');
            return;
        }
        
        if (this.betAmount > this.userManager.currentUser.balance) {
            this.showMessage('Saldo insuficiente!', 'error');
            return;
        }
        
        this.isSpinning = true;
        this.userManager.updateBalance(-this.betAmount);
        this.updateDisplay();
        this.winMessage.textContent = '';
        
        // Add spinning animation
        this.reel1.classList.add('spinning');
        this.reel2.classList.add('spinning');
        this.reel3.classList.add('spinning');
        
        this.spinButton.disabled = true;
        
        // Generate random symbols
        const symbol1 = this.getRandomSymbol();
        const symbol2 = this.getRandomSymbol();
        const symbol3 = this.getRandomSymbol();
        
        // Stop reels one by one
        setTimeout(() => {
            this.reel1.classList.remove('spinning');
            this.reel1.textContent = symbol1;
        }, 1000);
        
        setTimeout(() => {
            this.reel2.classList.remove('spinning');
            this.reel2.textContent = symbol2;
        }, 1500);
        
        setTimeout(() => {
            this.reel3.classList.remove('spinning');
            this.reel3.textContent = symbol3;
            
            // Check for wins
            this.checkWin(symbol1, symbol2, symbol3);
            
            this.isSpinning = false;
            this.spinButton.disabled = false;
        }, 2000);
    }
    
    getRandomSymbol() {
        return this.symbols[Math.floor(Math.random() * this.symbols.length)];
    }
    
    checkWin(symbol1, symbol2, symbol3) {
        let winAmount = 0;
        let message = '';
        
        // Three of a kind
        if (symbol1 === symbol2 && symbol2 === symbol3) {
            switch (symbol1) {
                case '7️⃣':
                    winAmount = this.betAmount * 100;
                    message = `JACKPOT! Você ganhou R$ ${winAmount}! 🎉`;
                    break;
                case '💎':
                    winAmount = this.betAmount * 50;
                    message = `DIAMANTES! Você ganhou R$ ${winAmount}! 💎`;
                    break;
                case '⭐':
                    winAmount = this.betAmount * 30;
                    message = `ESTRELAS! Você ganhou R$ ${winAmount}! ⭐`;
                    break;
                default:
                    winAmount = this.betAmount * 20;
                    message = `TRÊS IGUAIS! Você ganhou R$ ${winAmount}! 🎊`;
            }
        }
        // Two of a kind
        else if (symbol1 === symbol2 || symbol2 === symbol3 || symbol1 === symbol3) {
            winAmount = this.betAmount * 5;
            message = `DOIS IGUAIS! Você ganhou R$ ${winAmount}! 😊`;
        }
        // Any star
        else if (symbol1 === '⭐' || symbol2 === '⭐' || symbol3 === '⭐') {
            winAmount = this.betAmount * 2;
            message = `ESTRELA! Você ganhou R$ ${winAmount}! ✨`;
        }
        // Any diamond
        else if (symbol1 === '💎' || symbol2 === '💎' || symbol3 === '💎') {
            winAmount = this.betAmount * 3;
            message = `DIAMANTE! Você ganhou R$ ${winAmount}! 💎`;
        }
        
        if (winAmount > 0) {
            this.userManager.updateBalance(winAmount);
            this.showMessage(message, 'win');
        } else {
            this.showMessage('Tente novamente!', 'lose');
        }
        
        this.updateDisplay();
        
        // Add to game history
        this.userManager.addGameHistory(`Caça-Níqueis - ${winAmount > 0 ? 'Ganhou' : 'Perdeu'} R$ ${winAmount > 0 ? winAmount - this.betAmount : -this.betAmount}`);
        this.userManager.incrementGamesPlayed();
        
        // Check if game over
        if (this.userManager.currentUser.balance <= 0) {
            this.gameOver();
        }
    }
    
    showMessage(message, type) {
        this.winMessage.textContent = message;
        this.winMessage.className = 'win-message';
        
        if (type === 'win') {
            this.winMessage.style.color = '#4ECDC4';
            this.winMessage.style.animation = 'pulse 0.5s ease-in-out 3';
        } else if (type === 'error') {
            this.winMessage.style.color = '#FF6B6B';
        } else {
            this.winMessage.style.color = '#B8BCC8';
        }
    }
    
    updateDisplay() {
        if (this.userManager.currentUser) {
            this.balanceDisplay.textContent = this.userManager.currentUser.balance;
            this.betInput.max = Math.min(this.userManager.currentUser.balance, 100);
            
            if (this.betAmount > this.userManager.currentUser.balance) {
                this.betAmount = Math.min(this.userManager.currentUser.balance, 10);
                this.betInput.value = this.betAmount;
            }
        } else {
            this.balanceDisplay.textContent = '0';
            this.betInput.max = 0;
        }
    }
    
    gameOver() {
        this.showMessage('Game Over! Recarregue a página para jogar novamente.', 'error');
        this.spinButton.disabled = true;
    }
}

// Authentication and Modal Management
let isLoginMode = true;
let currentGame = null;

function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'block';
    resetAuthForm();
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthUI();
}

function updateAuthUI() {
    const title = document.getElementById('auth-title');
    const email = document.getElementById('auth-email');
    const confirmPassword = document.getElementById('auth-confirm-password');
    const submit = document.getElementById('auth-submit');
    const switchText = document.getElementById('auth-switch');
    
    if (isLoginMode) {
        title.textContent = 'Entrar';
        email.style.display = 'none';
        confirmPassword.style.display = 'none';
        submit.textContent = 'Entrar';
        switchText.innerHTML = 'Não tem uma conta? <a href="#" onclick="toggleAuthMode()">Registre-se</a>';
    } else {
        title.textContent = 'Registrar';
        email.style.display = 'block';
        confirmPassword.style.display = 'block';
        submit.textContent = 'Registrar';
        switchText.innerHTML = 'Já tem uma conta? <a href="#" onclick="toggleAuthMode()">Faça login</a>';
    }
}

function resetAuthForm() {
    document.getElementById('auth-form').reset();
}

function openGame(gameType) {
    if (!userManager.currentUser) {
        openAuthModal();
        return;
    }
    
    const modal = document.getElementById('game-modal');
    const container = document.getElementById('game-container');
    
    // Destroy previous game if exists
    if (currentGame) {
        currentGame = null;
    }
    
    // Create new game based on type
    switch (gameType) {
        case 'roulette':
            currentGame = new RouletteGame(userManager);
            container.innerHTML = currentGame.createGameUI();
            break;
        case 'poker':
            currentGame = new PokerGame(userManager);
            container.innerHTML = currentGame.createGameUI();
            break;
        case 'blackjack':
            currentGame = new BlackjackGame(userManager);
            container.innerHTML = currentGame.createGameUI();
            break;
        case 'slots':
            // Redirect to slot machine section
            closeGameModal();
            document.getElementById('slot-game').scrollIntoView({ behavior: 'smooth' });
            return;
    }
    
    // Initialize game after DOM is updated
    setTimeout(() => {
        if (currentGame && currentGame.initializeGame) {
            currentGame.initializeGame();
        }
    }, 100);
    
    modal.style.display = 'block';
}

function closeGameModal() {
    document.getElementById('game-modal').style.display = 'none';
    currentGame = null;
}

function openProfileModal() {
    if (!userManager.currentUser) return;
    
    const modal = document.getElementById('profile-modal');
    
    // Update profile information
    document.getElementById('profile-username').textContent = userManager.currentUser.username;
    document.getElementById('profile-email').textContent = userManager.currentUser.email;
    document.getElementById('profile-balance').textContent = `R$ ${userManager.currentUser.balance}`;
    document.getElementById('profile-winnings').textContent = `R$ ${userManager.currentUser.totalWinnings}`;
    document.getElementById('profile-games').textContent = userManager.currentUser.gamesPlayed;
    
    modal.style.display = 'block';
}

function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

function showDepositModal() {
    const amount = prompt('Digite o valor do depósito:');
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
        userManager.updateBalance(parseFloat(amount));
        alert(`Depósito de R$ ${amount} realizado com sucesso!`);
        openProfileModal(); // Refresh profile
    }
}

function showWithdrawModal() {
    const amount = prompt('Digite o valor do saque:');
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
        if (parseFloat(amount) <= userManager.currentUser.balance) {
            userManager.updateBalance(-parseFloat(amount));
            alert(`Saque de R$ ${amount} realizado com sucesso!`);
            openProfileModal(); // Refresh profile
        } else {
            alert('Saldo insuficiente!');
        }
    }
}

function showGameHistory() {
    const history = userManager.currentUser.gameHistory;
    if (history.length === 0) {
        alert('Nenhum jogo jogado ainda.');
        return;
    }
    
    let historyText = 'Histórico de Jogos:\n\n';
    history.slice(-10).reverse().forEach((game, index) => {
        const date = new Date(game.timestamp).toLocaleString('pt-BR');
        historyText += `${index + 1}. ${date}\n   ${game.game}\n   Saldo: R$ ${game.balance}\n\n`;
    });
    
    alert(historyText);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login button
    document.getElementById('login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal();
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        userManager.logout();
        alert('Você saiu da sua conta.');
    });
    
    // User menu
    document.getElementById('user-menu').addEventListener('click', (e) => {
        e.preventDefault();
        openProfileModal();
    });
    
    // Auth form
    document.getElementById('auth-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        
        if (isLoginMode) {
            const result = userManager.login(username, password);
            if (result.success) {
                alert(result.message);
                closeAuthModal();
            } else {
                alert(result.message);
            }
        } else {
            const email = document.getElementById('auth-email').value;
            const confirmPassword = document.getElementById('auth-confirm-password').value;
            
            if (password !== confirmPassword) {
                alert('As senhas não coincidem!');
                return;
            }
            
            const result = userManager.register(username, email, password);
            if (result.success) {
                alert(result.message);
                closeAuthModal();
            } else {
                alert(result.message);
            }
        }
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // Initialize slot machine
    let slotMachine;
    if (document.getElementById('slot-game')) {
        slotMachine = new SlotMachine(userManager);
    }
});

// Contact Form Handler
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const message = this.querySelector('textarea').value;
    
    // Simple validation
    if (!name || !email || !message) {
        alert('Por favor, preencha todos os campos!');
        return;
    }
    
    // Simulate form submission
    alert(`Obrigado pela sua mensagem, ${name}! Entraremos em contato em breve.`);
    this.reset();
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.game-card, .promo-card, .stat');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // Initialize slot machine
    const slotMachine = new SlotMachine();
    
    // Add parallax effect to hero section
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        const heroContent = document.querySelector('.hero-content');
        
        if (hero && heroContent) {
            heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
            hero.style.opacity = 1 - scrolled / 800;
        }
    });
    
    // Add hover effects to game cards
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Add typing effect to hero title
    const heroTitle = document.querySelector('.hero h2');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        let index = 0;
        
        function typeWriter() {
            if (index < text.length) {
                heroTitle.textContent += text.charAt(index);
                index++;
                setTimeout(typeWriter, 100);
            }
        }
        
        setTimeout(typeWriter, 500);
    }
});

// Add floating animation to cards
function createFloatingCard() {
    const card = document.createElement('div');
    card.className = 'floating-card';
    card.textContent = ['🎰', '🎲', '🃏', '🎯'][Math.floor(Math.random() * 4)];
    card.style.cssText = `
        position: fixed;
        font-size: 2rem;
        pointer-events: none;
        z-index: 1;
        animation: floatUp 3s ease-in forwards;
        left: ${Math.random() * window.innerWidth}px;
        bottom: -50px;
    `;
    
    document.body.appendChild(card);
    
    setTimeout(() => {
        card.remove();
    }, 3000);
}

// Create floating cards periodically
setInterval(createFloatingCard, 5000);

// Add CSS for floating animation
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add confetti effect for big wins
function createConfetti() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFA500', '#FF1493'];
    const confettiCount = 100;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            pointer-events: none;
            z-index: 9999;
            left: ${Math.random() * window.innerWidth}px;
            top: -10px;
            animation: confettiFall 3s ease-in forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 3500);
    }
}

// Add CSS for confetti animation
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(confettiStyle);

// Modify the slot machine to trigger confetti for big wins
const originalCheckWin = SlotMachine.prototype.checkWin;
SlotMachine.prototype.checkWin = function(symbol1, symbol2, symbol3) {
    const result = originalCheckWin.call(this, symbol1, symbol2, symbol3);
    
    // Trigger confetti for jackpot or big wins
    if (symbol1 === symbol2 && symbol2 === symbol3 && symbol1 === '7️⃣') {
        createConfetti();
    }
    
    return result;
};

// Add sound effects (using Web Audio API for simple sounds)
class SoundEffects {
    constructor() {
        this.audioContext = null;
        this.initAudio();
    }
    
    initAudio() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSound(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playWinSound() {
        this.playSound(523.25, 0.1); // C5
        setTimeout(() => this.playSound(659.25, 0.1), 100); // E5
        setTimeout(() => this.playSound(783.99, 0.2), 200); // G5
    }
    
    playLoseSound() {
        this.playSound(200, 0.3, 'sawtooth');
    }
    
    playSpinSound() {
        this.playSound(440, 0.05);
        setTimeout(() => this.playSound(440, 0.05), 50);
        setTimeout(() => this.playSound(440, 0.05), 100);
    }
}

// Initialize sound effects
const soundEffects = new SoundEffects();

// Modify slot machine to include sound effects
const originalSpin = SlotMachine.prototype.spin;
SlotMachine.prototype.spin = function() {
    soundEffects.playSpinSound();
    return originalSpin.call(this);
};

const originalCheckWinWithSound = SlotMachine.prototype.checkWin;
SlotMachine.prototype.checkWin = function(symbol1, symbol2, symbol3) {
    const result = originalCheckWinWithSound.call(this, symbol1, symbol2, symbol3);
    
    // Play appropriate sound based on result
    setTimeout(() => {
        const winMessage = this.winMessage.textContent;
        if (winMessage.includes('ganhou')) {
            soundEffects.playWinSound();
        } else if (winMessage.includes('Tente novamente')) {
            soundEffects.playLoseSound();
        }
    }, 2000);
    
    return result;
};
