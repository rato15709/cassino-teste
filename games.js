// User Management System
class UserManager {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('casinoUsers')) || {};
        this.loadUser();
    }

    loadUser() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUI();
        }
    }

    register(username, email, password) {
        if (this.users[username]) {
            return { success: false, message: 'Nome de usuário já existe!' };
        }

        if (password.length < 6) {
            return { success: false, message: 'A senha deve ter pelo menos 6 caracteres!' };
        }

        const newUser = {
            username,
            email,
            password,
            balance: 1000,
            totalWinnings: 0,
            gamesPlayed: 0,
            gameHistory: [],
            createdAt: new Date().toISOString()
        };

        this.users[username] = newUser;
        this.saveUsers();
        
        return { success: true, message: 'Cadastro realizado com sucesso!' };
    }

    login(username, password) {
        const user = this.users[username];
        
        if (!user) {
            return { success: false, message: 'Usuário não encontrado!' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Senha incorreta!' };
        }

        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.updateUI();
        
        return { success: true, message: 'Login realizado com sucesso!' };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.updateUI();
    }

    updateBalance(amount) {
        if (this.currentUser) {
            this.currentUser.balance += amount;
            if (amount > 0) {
                this.currentUser.totalWinnings += amount;
            }
            this.saveCurrentUser();
            this.updateUI();
        }
    }

    incrementGamesPlayed() {
        if (this.currentUser) {
            this.currentUser.gamesPlayed++;
            this.saveCurrentUser();
            this.updateUI();
        }
    }

    addGameHistory(game) {
        if (this.currentUser) {
            this.currentUser.gameHistory.push({
                game,
                timestamp: new Date().toISOString(),
                balance: this.currentUser.balance
            });
            this.saveCurrentUser();
        }
    }

    saveUsers() {
        localStorage.setItem('casinoUsers', JSON.stringify(this.users));
    }

    saveCurrentUser() {
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.users[this.currentUser.username] = this.currentUser;
            this.saveUsers();
        }
    }

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (this.currentUser) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            userMenu.style.display = 'block';
            
            // Update balance display in slot machine
            const balanceDisplay = document.getElementById('balance');
            if (balanceDisplay) {
                balanceDisplay.textContent = this.currentUser.balance;
            }
        } else {
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            userMenu.style.display = 'none';
        }
    }
}

// Roulette Game
class RouletteGame {
    constructor(userManager) {
        this.userManager = userManager;
        this.numbers = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
        this.isSpinning = false;
        this.currentBet = null;
        this.betAmount = 10;
    }

    createGameUI() {
        return `
            <div class="roulette-game">
                <h2>Roleta Europeia</h2>
                <div class="game-info">
                    <div class="info-item">
                        <div class="info-label">Saldo</div>
                        <div class="info-value" id="roulette-balance">R$ ${this.userManager.currentUser.balance}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Aposta</div>
                        <div class="info-value">R$ <input type="number" id="roulette-bet" value="10" min="1" max="${this.userManager.currentUser.balance}" style="width: 80px;"></div>
                    </div>
                </div>
                
                <div class="roulette-wheel-container">
                    <div class="roulette-wheel-display" id="roulette-wheel">
                        <div class="roulette-ball" id="roulette-ball"></div>
                    </div>
                    <div id="roulette-result" style="margin-top: 1rem; font-size: 1.2rem; color: var(--primary-color);"></div>
                </div>
                
                <div class="roulette-betting">
                    <div class="bet-option" data-bet="red">Vermelho</div>
                    <div class="bet-option" data-bet="black">Preto</div>
                    <div class="bet-option" data-bet="odd">Ímpar</div>
                    <div class="bet-option" data-bet="even">Par</div>
                    <div class="bet-option" data-bet="1-18">1-18</div>
                    <div class="bet-option" data-bet="19-36">19-36</div>
                </div>
                
                <div style="margin-top: 2rem;">
                    <button id="spin-roulette" class="btn-primary btn-large">GIRAR RODA</button>
                </div>
            </div>
        `;
    }

    initializeGame() {
        const betOptions = document.querySelectorAll('.bet-option');
        const spinButton = document.getElementById('spin-roulette');
        const betInput = document.getElementById('roulette-bet');
        
        betOptions.forEach(option => {
            option.addEventListener('click', () => {
                betOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.currentBet = option.dataset.bet;
            });
        });
        
        spinButton.addEventListener('click', () => this.spin());
        
        betInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0 && value <= this.userManager.currentUser.balance) {
                this.betAmount = value;
            } else {
                e.target.value = this.betAmount;
            }
        });
    }

    spin() {
        if (this.isSpinning) return;
        
        if (!this.currentBet) {
            this.showMessage('Selecione uma aposta!', 'error');
            return;
        }
        
        if (this.betAmount > this.userManager.currentUser.balance) {
            this.showMessage('Saldo insuficiente!', 'error');
            return;
        }
        
        this.isSpinning = true;
        this.userManager.updateBalance(-this.betAmount);
        
        const wheel = document.getElementById('roulette-wheel');
        const ball = document.getElementById('roulette-ball');
        const resultDiv = document.getElementById('roulette-result');
        const spinButton = document.getElementById('spin-roulette');
        
        spinButton.disabled = true;
        resultDiv.textContent = '';
        
        // Generate random result
        const resultIndex = Math.floor(Math.random() * this.numbers.length);
        const resultNumber = this.numbers[resultIndex];
        
        // Calculate rotation
        const baseRotation = 360 * 5; // 5 full rotations
        const targetRotation = baseRotation + (resultIndex * (360 / this.numbers.length));
        
        // Animate wheel
        wheel.style.transform = `rotate(${targetRotation}deg)`;
        
        // Animate ball
        ball.style.transition = 'all 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        ball.style.transform = `translate(-50%, -50%) rotate(${-targetRotation}deg) translateX(120px)`;
        
        setTimeout(() => {
            this.checkResult(resultNumber);
            this.isSpinning = false;
            spinButton.disabled = false;
            
            // Reset positions
            setTimeout(() => {
                wheel.style.transition = 'none';
                wheel.style.transform = 'rotate(0deg)';
                ball.style.transition = 'none';
                ball.style.transform = 'translate(-50%, -50%)';
                
                setTimeout(() => {
                    wheel.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
                    ball.style.transition = 'all 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
                }, 100);
            }, 2000);
        }, 3000);
    }

    checkResult(number) {
        const resultDiv = document.getElementById('roulette-result');
        let won = false;
        let winAmount = 0;
        let color = 'Verde';
        
        if (number === 0) {
            color = 'Verde';
        } else if (this.redNumbers.includes(number)) {
            color = 'Vermelho';
        } else {
            color = 'Preto';
        }
        
        // Check bets
        if (this.currentBet === 'red' && this.redNumbers.includes(number)) {
            won = true;
            winAmount = this.betAmount * 2;
        } else if (this.currentBet === 'black' && this.blackNumbers.includes(number)) {
            won = true;
            winAmount = this.betAmount * 2;
        } else if (this.currentBet === 'odd' && number % 2 === 1 && number !== 0) {
            won = true;
            winAmount = this.betAmount * 2;
        } else if (this.currentBet === 'even' && number % 2 === 0 && number !== 0) {
            won = true;
            winAmount = this.betAmount * 2;
        } else if (this.currentBet === '1-18' && number >= 1 && number <= 18) {
            won = true;
            winAmount = this.betAmount * 2;
        } else if (this.currentBet === '19-36' && number >= 19 && number <= 36) {
            won = true;
            winAmount = this.betAmount * 2;
        }
        
        if (won) {
            this.userManager.updateBalance(winAmount);
            resultDiv.innerHTML = `<strong>${number} ${color}</strong><br>Você ganhou R$ ${winAmount}! 🎉`;
            resultDiv.style.color = '#4ECDC4';
        } else {
            resultDiv.innerHTML = `<strong>${number} ${color}</strong><br>Tente novamente!`;
            resultDiv.style.color = '#FF6B6B';
        }
        
        // Update balance display
        document.getElementById('roulette-balance').textContent = `R$ ${this.userManager.currentUser.balance}`;
        
        // Add to game history
        this.userManager.addGameHistory(`Roleta - ${number} ${color} - ${won ? 'Ganhou' : 'Perdeu'} R$ ${won ? winAmount - this.betAmount : -this.betAmount}`);
        this.userManager.incrementGamesPlayed();
    }

    showMessage(message, type) {
        const resultDiv = document.getElementById('roulette-result');
        resultDiv.textContent = message;
        resultDiv.style.color = type === 'error' ? '#FF6B6B' : '#4ECDC4';
    }
}

// Poker Game (Simplified Texas Hold'em)
class PokerGame {
    constructor(userManager) {
        this.userManager = userManager;
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.communityCards = [];
        this.betAmount = 10;
        this.pot = 0;
        this.gamePhase = 'preflop';
    }

    createGameUI() {
        return `
            <div class="poker-game">
                <h2>Texas Hold'em Poker</h2>
                <div class="game-info">
                    <div class="info-item">
                        <div class="info-label">Saldo</div>
                        <div class="info-value" id="poker-balance">R$ ${this.userManager.currentUser.balance}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Pote</div>
                        <div class="info-value" id="poker-pot">R$ 0</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Aposta</div>
                        <div class="info-value">R$ <input type="number" id="poker-bet" value="10" min="1" max="${this.userManager.currentUser.balance}" style="width: 80px;"></div>
                    </div>
                </div>
                
                <div class="poker-table">
                    <div style="margin-bottom: 1rem;">
                        <strong>Dealer</strong>
                        <div class="poker-cards-display" id="dealer-cards"></div>
                    </div>
                    
                    <div style="margin: 2rem 0;">
                        <strong>Comunidade</strong>
                        <div class="poker-cards-display" id="community-cards"></div>
                    </div>
                    
                    <div style="margin-top: 1rem;">
                        <strong>Sua Mão</strong>
                        <div class="poker-cards-display" id="player-cards"></div>
                    </div>
                    
                    <div id="poker-result" style="margin-top: 1rem; font-size: 1.2rem; color: var(--primary-color);"></div>
                </div>
                
                <div class="poker-controls">
                    <button id="new-poker-game" class="btn-primary">Novo Jogo</button>
                    <button id="poker-call" class="btn-secondary" disabled>Apostar</button>
                    <button id="poker-fold" class="btn-secondary" disabled>Desistir</button>
                </div>
            </div>
        `;
    }

    initializeGame() {
        const newGameBtn = document.getElementById('new-poker-game');
        const callBtn = document.getElementById('poker-call');
        const foldBtn = document.getElementById('poker-fold');
        const betInput = document.getElementById('poker-bet');
        
        newGameBtn.addEventListener('click', () => this.newGame());
        callBtn.addEventListener('click', () => this.call());
        foldBtn.addEventListener('click', () => this.fold());
        
        betInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0 && value <= this.userManager.currentUser.balance) {
                this.betAmount = value;
            } else {
                e.target.value = this.betAmount;
            }
        });
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({
                    rank,
                    suit,
                    color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
                    value: this.getCardValue(rank)
                });
            }
        }
        
        return this.shuffleDeck(deck);
    }

    getCardValue(rank) {
        if (rank === 'A') return 14;
        if (rank === 'K') return 13;
        if (rank === 'Q') return 12;
        if (rank === 'J') return 11;
        return parseInt(rank);
    }

    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    newGame() {
        if (this.betAmount > this.userManager.currentUser.balance) {
            this.showMessage('Saldo insuficiente!', 'error');
            return;
        }
        
        this.deck = this.createDeck();
        this.playerHand = [this.deck.pop(), this.deck.pop()];
        this.dealerHand = [this.deck.pop(), this.deck.pop()];
        this.communityCards = [];
        this.pot = this.betAmount * 2;
        this.gamePhase = 'preflop';
        
        this.userManager.updateBalance(-this.betAmount);
        
        this.updateDisplay();
        this.enableButtons();
        
        document.getElementById('poker-result').textContent = '';
    }

    call() {
        if (this.gamePhase === 'preflop') {
            // Flop
            this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
            this.gamePhase = 'flop';
        } else if (this.gamePhase === 'flop') {
            // Turn
            this.communityCards.push(this.deck.pop());
            this.gamePhase = 'turn';
        } else if (this.gamePhase === 'turn') {
            // River
            this.communityCards.push(this.deck.pop());
            this.gamePhase = 'river';
        } else if (this.gamePhase === 'river') {
            // Showdown
            this.showdown();
            return;
        }
        
        this.userManager.updateBalance(-this.betAmount);
        this.pot += this.betAmount;
        this.updateDisplay();
    }

    fold() {
        this.showMessage('Você desistiu. Dealer vence!', 'lose');
        this.disableButtons();
        this.userManager.addGameHistory(`Poker - Desistiu - Perdeu R$ ${this.betAmount}`);
        this.userManager.incrementGamesPlayed();
    }

    showdown() {
        const playerScore = this.evaluateHand([...this.playerHand, ...this.communityCards]);
        const dealerScore = this.evaluateHand([...this.dealerHand, ...this.communityCards]);
        
        // Show dealer cards
        this.displayCards('dealer-cards', this.dealerHand);
        
        let winner = '';
        let winAmount = 0;
        
        if (playerScore.rank > dealerScore.rank) {
            winner = 'Você venceu!';
            winAmount = this.pot;
            this.userManager.updateBalance(winAmount);
        } else if (dealerScore.rank > playerScore.rank) {
            winner = 'Dealer venceu!';
        } else {
            winner = 'Empate!';
            winAmount = this.pot / 2;
            this.userManager.updateBalance(winAmount);
        }
        
        this.showMessage(`${winner} ${winAmount > 0 ? `Ganhou R$ ${winAmount}` : ''}`, winAmount > 0 ? 'win' : 'lose');
        this.disableButtons();
        
        this.userManager.addGameHistory(`Poker - ${winner} - ${winAmount > 0 ? 'Ganhou' : 'Perdeu'} R$ ${Math.abs(winAmount - this.betAmount)}`);
        this.userManager.incrementGamesPlayed();
    }

    evaluateHand(cards) {
        // Simplified hand evaluation
        const ranks = cards.map(c => c.value).sort((a, b) => b - a);
        const suits = cards.map(c => c.suit);
        
        const rankCounts = {};
        ranks.forEach(rank => {
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });
        
        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        
        // Check for different hand types
        if (counts[0] === 4) return { rank: 7, name: 'Quadra' }; // Four of a kind
        if (counts[0] === 3 && counts[1] === 2) return { rank: 6, name: 'Full House' };
        if (counts[0] === 3) return { rank: 3, name: 'Trinca' };
        if (counts[0] === 2 && counts[1] === 2) return { rank: 2, name: 'Dois Pares' };
        if (counts[0] === 2) return { rank: 1, name: 'Par' };
        
        return { rank: 0, name: 'Carta Alta' };
    }

    displayCards(elementId, cards, hidden = false) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        
        cards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `poker-card ${card.color}`;
            
            if (hidden) {
                cardDiv.textContent = '?';
                cardDiv.style.background = 'linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%, #2a2a2a)';
                cardDiv.style.color = 'white';
            } else {
                cardDiv.textContent = `${card.rank}${card.suit}`;
            }
            
            container.appendChild(cardDiv);
        });
    }

    updateDisplay() {
        this.displayCards('player-cards', this.playerHand);
        this.displayCards('dealer-cards', this.dealerHand, true);
        this.displayCards('community-cards', this.communityCards);
        
        document.getElementById('poker-balance').textContent = `R$ ${this.userManager.currentUser.balance}`;
        document.getElementById('poker-pot').textContent = `R$ ${this.pot}`;
    }

    enableButtons() {
        document.getElementById('poker-call').disabled = false;
        document.getElementById('poker-fold').disabled = false;
    }

    disableButtons() {
        document.getElementById('poker-call').disabled = true;
        document.getElementById('poker-fold').disabled = true;
    }

    showMessage(message, type) {
        const resultDiv = document.getElementById('poker-result');
        resultDiv.innerHTML = message;
        resultDiv.style.color = type === 'win' ? '#4ECDC4' : type === 'lose' ? '#FF6B6B' : '#FFD700';
    }
}

// Blackjack Game
class BlackjackGame {
    constructor(userManager) {
        this.userManager = userManager;
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.betAmount = 10;
        this.gameActive = false;
    }

    createGameUI() {
        return `
            <div class="blackjack-game">
                <h2>Blackjack 21</h2>
                <div class="game-info">
                    <div class="info-item">
                        <div class="info-label">Saldo</div>
                        <div class="info-value" id="blackjack-balance">R$ ${this.userManager.currentUser.balance}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Aposta</div>
                        <div class="info-value">R$ <input type="number" id="blackjack-bet" value="10" min="1" max="${this.userManager.currentUser.balance}" style="width: 80px;"></div>
                    </div>
                </div>
                
                <div class="blackjack-table-display">
                    <div style="margin-bottom: 2rem;">
                        <strong>Dealer (Pontos: <span id="dealer-points">0</span>)</strong>
                        <div class="blackjack-hand" id="dealer-hand"></div>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <strong>Sua Mão (Pontos: <span id="player-points">0</span>)</strong>
                        <div class="blackjack-hand" id="player-hand"></div>
                    </div>
                    
                    <div id="blackjack-result" style="margin-top: 2rem; font-size: 1.2rem; color: var(--primary-color);"></div>
                </div>
                
                <div class="blackjack-controls">
                    <button id="new-blackjack-game" class="btn-primary">Novo Jogo</button>
                    <button id="blackjack-hit" class="btn-secondary" disabled>Pedir Carta</button>
                    <button id="blackjack-stand" class="btn-secondary" disabled>Parar</button>
                </div>
            </div>
        `;
    }

    initializeGame() {
        const newGameBtn = document.getElementById('new-blackjack-game');
        const hitBtn = document.getElementById('blackjack-hit');
        const standBtn = document.getElementById('blackjack-stand');
        const betInput = document.getElementById('blackjack-bet');
        
        newGameBtn.addEventListener('click', () => this.newGame());
        hitBtn.addEventListener('click', () => this.hit());
        standBtn.addEventListener('click', () => this.stand());
        
        betInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0 && value <= this.userManager.currentUser.balance) {
                this.betAmount = value;
            } else {
                e.target.value = this.betAmount;
            }
        });
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({
                    rank,
                    suit,
                    color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
                    value: this.getCardValue(rank)
                });
            }
        }
        
        return this.shuffleDeck(deck);
    }

    getCardValue(rank) {
        if (rank === 'A') return 11;
        if (['K', 'Q', 'J'].includes(rank)) return 10;
        return parseInt(rank);
    }

    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    newGame() {
        if (this.betAmount > this.userManager.currentUser.balance) {
            this.showMessage('Saldo insuficiente!', 'error');
            return;
        }
        
        this.deck = this.createDeck();
        this.playerHand = [this.deck.pop(), this.deck.pop()];
        this.dealerHand = [this.deck.pop(), this.deck.pop()];
        this.gameActive = true;
        
        this.userManager.updateBalance(-this.betAmount);
        
        this.updateDisplay(true);
        this.enableButtons();
        
        document.getElementById('blackjack-result').textContent = '';
        
        // Check for blackjack
        const playerPoints = this.calculatePoints(this.playerHand);
        if (playerPoints === 21) {
            this.stand();
        }
    }

    hit() {
        if (!this.gameActive) return;
        
        this.playerHand.push(this.deck.pop());
        this.updateDisplay(false);
        
        const playerPoints = this.calculatePoints(this.playerHand);
        if (playerPoints > 21) {
            this.endGame('bust');
        } else if (playerPoints === 21) {
            this.stand();
        }
    }

    stand() {
        if (!this.gameActive) return;
        
        this.gameActive = false;
        this.disableButtons();
        
        // Dealer plays
        this.dealerPlay();
    }

    dealerPlay() {
        this.updateDisplay(false);
        
        const dealerPoints = this.calculatePoints(this.dealerHand);
        
        if (dealerPoints < 17) {
            setTimeout(() => {
                this.dealerHand.push(this.deck.pop());
                this.dealerPlay();
            }, 1000);
        } else {
            this.determineWinner();
        }
    }

    calculatePoints(hand) {
        let points = 0;
        let aces = 0;
        
        for (const card of hand) {
            if (card.rank === 'A') {
                aces++;
                points += 11;
            } else {
                points += card.value;
            }
        }
        
        while (points > 21 && aces > 0) {
            points -= 10;
            aces--;
        }
        
        return points;
    }

    determineWinner() {
        const playerPoints = this.calculatePoints(this.playerHand);
        const dealerPoints = this.calculatePoints(this.dealerHand);
        
        let result = '';
        let winAmount = 0;
        
        if (dealerPoints > 21) {
            result = 'Dealer estourou! Você venceu!';
            winAmount = this.betAmount * 2;
        } else if (playerPoints > dealerPoints) {
            result = 'Você venceu!';
            winAmount = this.betAmount * 2;
        } else if (dealerPoints > playerPoints) {
            result = 'Dealer venceu!';
        } else {
            result = 'Empate!';
            winAmount = this.betAmount;
        }
        
        if (winAmount > 0) {
            this.userManager.updateBalance(winAmount);
        }
        
        this.showMessage(`${result} ${winAmount > 0 ? `Ganhou R$ ${winAmount}` : ''}`, winAmount > 0 ? 'win' : 'lose');
        
        this.userManager.addGameHistory(`Blackjack - ${result} - ${winAmount > 0 ? 'Ganhou' : 'Perdeu'} R$ ${Math.abs(winAmount - this.betAmount)}`);
        this.userManager.incrementGamesPlayed();
    }

    endGame(reason) {
        this.gameActive = false;
        this.disableButtons();
        
        if (reason === 'bust') {
            this.showMessage('Você estourou! Dealer venceu!', 'lose');
            this.userManager.addGameHistory(`Blackjack - Estourou - Perdeu R$ ${this.betAmount}`);
            this.userManager.incrementGamesPlayed();
        }
    }

    displayCards(elementId, cards, hideFirst = false) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        
        cards.forEach((card, index) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `poker-card ${card.color}`;
            
            if (hideFirst && index === 0) {
                cardDiv.textContent = '?';
                cardDiv.style.background = 'linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%, #2a2a2a)';
                cardDiv.style.color = 'white';
            } else {
                cardDiv.textContent = `${card.rank}${card.suit}`;
            }
            
            container.appendChild(cardDiv);
        });
    }

    updateDisplay(hideDealerCard = true) {
        this.displayCards('player-hand', this.playerHand);
        this.displayCards('dealer-hand', this.dealerHand, hideDealerCard);
        
        document.getElementById('player-points').textContent = this.calculatePoints(this.playerHand);
        document.getElementById('dealer-points').textContent = hideDealerCard ? '?' : this.calculatePoints(this.dealerHand);
        document.getElementById('blackjack-balance').textContent = `R$ ${this.userManager.currentUser.balance}`;
    }

    enableButtons() {
        document.getElementById('blackjack-hit').disabled = false;
        document.getElementById('blackjack-stand').disabled = false;
    }

    disableButtons() {
        document.getElementById('blackjack-hit').disabled = true;
        document.getElementById('blackjack-stand').disabled = true;
    }

    showMessage(message, type) {
        const resultDiv = document.getElementById('blackjack-result');
        resultDiv.innerHTML = message;
        resultDiv.style.color = type === 'win' ? '#4ECDC4' : type === 'lose' ? '#FF6B6B' : '#FFD700';
    }
}
