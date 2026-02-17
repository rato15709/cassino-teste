const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }
        req.user = user;
        next();
    });
};

// Get available games
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const { type, betMin, betMax } = req.query;
        
        const betRange = {};
        if (betMin || betMax) {
            betRange.min = parseFloat(betMin) || 0;
            betRange.max = parseFloat(betMax) || 999999;
        }

        const games = await Game.findAvailableGames(type, betRange)
            .populate('players', 'username avatar')
            .limit(20);

        res.json({ games });

    } catch (error) {
        console.error('Get available games error:', error);
        res.status(500).json({ error: 'Erro ao buscar jogos disponíveis' });
    }
});

// Create new game
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { type, betAmount, settings = {} } = req.body;

        if (!type || !betAmount) {
            return res.status(400).json({ error: 'Tipo e valor da aposta são obrigatórios' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!user.canAfford(betAmount)) {
            return res.status(400).json({ error: 'Saldo insuficiente' });
        }

        // Validate bet amount
        if (betAmount < process.env.MIN_BET || betAmount > process.env.MAX_BET) {
            return res.status(400).json({ 
                error: `Valor da aposta deve estar entre R$ ${process.env.MIN_BET} e R$ ${process.env.MAX_BET}` 
            });
        }

        // Create game
        const game = new Game({
            type,
            betAmount,
            players: [req.user.id],
            settings: {
                ...settings,
                isPrivate: settings.isPrivate || false,
                allowSpectators: settings.allowSpectators !== false
            }
        });

        await game.save();

        // Create bet transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'bet',
            amount: betAmount,
            description: `Aposta no jogo ${type}`,
            status: 'completed',
            game: game._id
        });

        await transaction.save();
        await user.addToBalance(-betAmount, 'bet');

        res.status(201).json({
            message: 'Jogo criado com sucesso',
            game: await game.populate('players', 'username avatar')
        });

    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Erro ao criar jogo' });
    }
});

// Join existing game
router.post('/join', authenticateToken, async (req, res) => {
    try {
        const { gameId } = req.body;

        if (!gameId) {
            return res.status(400).json({ error: 'ID do jogo é obrigatório' });
        }

        const game = await Game.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        if (game.status !== 'waiting') {
            return res.status(400).json({ error: 'Jogo não está mais disponível' });
        }

        if (game.isFull) {
            return res.status(400).json({ error: 'Jogo está cheio' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!user.canAfford(game.betAmount)) {
            return res.status(400).json({ error: 'Saldo insuficiente' });
        }

        // Check if user already in game
        if (game.players.includes(req.user.id)) {
            return res.status(400).json({ error: 'Usuário já está no jogo' });
        }

        // Add player to game
        await game.addPlayer(req.user.id);

        // Create bet transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'bet',
            amount: game.betAmount,
            description: `Aposta no jogo ${game.type}`,
            status: 'completed',
            game: game._id
        });

        await transaction.save();
        await user.addToBalance(-game.betAmount, 'bet');

        // Start game if full
        if (game.isFull) {
            await game.startGame();
        }

        res.json({
            message: 'Entrou no jogo com sucesso',
            game: await game.populate('players', 'username avatar')
        });

    } catch (error) {
        console.error('Join game error:', error);
        res.status(500).json({ error: 'Erro ao entrar no jogo' });
    }
});

// Get game details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id)
            .populate('players winner spectators.user', 'username avatar')
            .populate('moves.player', 'username');

        if (!game) {
            return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        // Check if user is participant or spectator
        const isParticipant = game.players.some(p => p._id.toString() === req.user.id);
        const isSpectator = game.spectators.some(s => s.user._id.toString() === req.user.id);

        if (!isParticipant && !isSpectator && !game.settings.allowSpectators) {
            return res.status(403).json({ error: 'Acesso negado a este jogo' });
        }

        res.json({ game });

    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Erro ao buscar jogo' });
    }
});

// Make a move in a game
router.post('/:id/move', authenticateToken, async (req, res) => {
    try {
        const { move } = req.body;
        const gameId = req.params.id;

        if (!move) {
            return res.status(400).json({ error: 'Jogada é obrigatória' });
        }

        const game = await Game.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        if (game.status !== 'playing') {
            return res.status(400).json({ error: 'Jogo não está em andamento' });
        }

        // Check if user is a player
        if (!game.players.includes(req.user.id)) {
            return res.status(403).json({ error: 'Você não é um participante deste jogo' });
        }

        // Add move to game
        await game.addMove(req.user.id, move);

        // Process game-specific logic
        await processGameMove(game, req.user.id, move);

        res.json({
            message: 'Jogada realizada com sucesso',
            gameState: game.gameState
        });

    } catch (error) {
        console.error('Make move error:', error);
        res.status(500).json({ error: 'Erro ao fazer jogada' });
    }
});

// Join as spectator
router.post('/:id/spectate', authenticateToken, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        if (!game.settings.allowSpectators) {
            return res.status(403).json({ error: 'Espectadores não permitidos neste jogo' });
        }

        await game.addSpectator(req.user.id);

        res.json({ message: 'Entrou como espectador com sucesso' });

    } catch (error) {
        console.error('Spectate game error:', error);
        res.status(500).json({ error: 'Erro ao entrar como espectador' });
    }
});

// Leave game
router.post('/:id/leave', authenticateToken, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        // Remove from players or spectators
        const isPlayer = game.players.includes(req.user.id);
        const isSpectator = game.spectators.some(s => s.user.toString() === req.user.id);

        if (isPlayer) {
            await game.removePlayer(req.user.id);
            
            // Refund if game didn't start
            if (game.status === 'waiting') {
                const user = await User.findById(req.user.id);
                await user.addToBalance(game.betAmount, 'refund');
                
                const refundTransaction = new Transaction({
                    user: req.user.id,
                    type: 'refund',
                    amount: game.betAmount,
                    description: 'Reembolso - jogo cancelado',
                    status: 'completed',
                    game: game._id
                });
                
                await refundTransaction.save();
            }
        } else if (isSpectator) {
            await game.removeSpectator(req.user.id);
        }

        res.json({ message: 'Saiu do jogo com sucesso' });

    } catch (error) {
        console.error('Leave game error:', error);
        res.status(500).json({ error: 'Erro ao sair do jogo' });
    }
});

// Get user game history
router.get('/history/user', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        
        const filters = {};
        if (type) filters.type = type;

        const games = await Game.getUserGameHistory(req.user.id, parseInt(limit));
        
        const total = await Game.countDocuments({
            players: req.user.id,
            ...filters
        });

        res.json({
            games,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get game history error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de jogos' });
    }
});

// Get game statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const userGames = await Game.find({
            players: req.user.id,
            createdAt: { $gte: startDate }
        });

        const statistics = {
            totalGames: userGames.length,
            gamesWon: userGames.filter(g => g.winner && g.winner.toString() === req.user.id).length,
            totalBet: userGames.reduce((sum, g) => sum + g.betAmount, 0),
            totalWinnings: 0,
            favoriteGame: null,
            averageBet: 0,
            winRate: 0
        };

        // Calculate total winnings
        const winningGames = userGames.filter(g => g.winner && g.winner.toString() === req.user.id);
        statistics.totalWinnings = winningGames.reduce((sum, g) => sum + (g.winnings || 0), 0);

        // Calculate average bet
        statistics.averageBet = statistics.totalGames > 0 ? statistics.totalBet / statistics.totalGames : 0;

        // Calculate win rate
        statistics.winRate = statistics.totalGames > 0 ? (statistics.gamesWon / statistics.totalGames * 100) : 0;

        // Find favorite game type
        const gameTypes = {};
        userGames.forEach(g => {
            gameTypes[g.type] = (gameTypes[g.type] || 0) + 1;
        });
        
        statistics.favoriteGame = Object.keys(gameTypes).reduce((a, b) => 
            gameTypes[a] > gameTypes[b] ? a : b, '');

        res.json({ statistics });

    } catch (error) {
        console.error('Get game statistics error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Game-specific move processing
async function processGameMove(game, userId, move) {
    switch (game.type) {
        case 'slots':
            await processSlotsMove(game, userId, move);
            break;
        case 'roulette':
            await processRouletteMove(game, userId, move);
            break;
        case 'poker':
            await processPokerMove(game, userId, move);
            break;
        case 'blackjack':
            await processBlackjackMove(game, userId, move);
            break;
        default:
            console.log(`Game type ${game.type} not implemented`);
    }
}

// Slots game logic
async function processSlotsMove(game, userId, move) {
    const { bet, symbols } = move;
    
    // Generate random symbols
    const slotSymbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣'];
    const result = [
        slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
        slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
        slotSymbols[Math.floor(Math.random() * slotSymbols.length)]
    ];

    // Check for wins
    let winAmount = 0;
    if (result[0] === result[1] && result[1] === result[2]) {
        switch (result[0]) {
            case '7️⃣':
                winAmount = bet * 100;
                break;
            case '💎':
                winAmount = bet * 50;
                break;
            case '⭐':
                winAmount = bet * 30;
                break;
            default:
                winAmount = bet * 20;
        }
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        winAmount = bet * 5;
    }

    // Update game state
    game.gameState.lastResult = result;
    game.gameState.lastWin = winAmount;

    if (winAmount > 0) {
        game.winner = userId;
        game.winnings = winAmount;
        await game.endGame(userId);

        // Process win
        const user = await User.findById(userId);
        await user.addToBalance(winAmount, 'win');
        user.gamesWon++;
        await user.save();

        // Create win transaction
        const transaction = new Transaction({
            user: userId,
            type: 'win',
            amount: winAmount,
            description: `Ganho no caça-níqueis`,
            status: 'completed',
            game: game._id
        });
        await transaction.save();
    } else {
        game.status = 'completed';
        await game.save();
    }
}

// Roulette game logic
async function processRouletteMove(game, userId, move) {
    const { betType, betAmount } = move;
    
    // Generate random number
    const number = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number);
    const isBlack = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].includes(number);
    const isEven = number > 0 && number % 2 === 0;
    const isOdd = number % 2 === 1;

    let won = false;
    let winAmount = 0;

    // Check bet type
    switch (betType) {
        case 'red':
            won = isRed;
            winAmount = won ? betAmount * 2 : 0;
            break;
        case 'black':
            won = isBlack;
            winAmount = won ? betAmount * 2 : 0;
            break;
        case 'even':
            won = isEven;
            winAmount = won ? betAmount * 2 : 0;
            break;
        case 'odd':
            won = isOdd;
            winAmount = won ? betAmount * 2 : 0;
            break;
        case '1-18':
            won = number >= 1 && number <= 18;
            winAmount = won ? betAmount * 2 : 0;
            break;
        case '19-36':
            won = number >= 19 && number <= 36;
            winAmount = won ? betAmount * 2 : 0;
            break;
    }

    // Update game state
    game.gameState.lastNumber = number;
    game.gameState.lastColor = number === 0 ? 'green' : (isRed ? 'red' : 'black');
    game.gameState.lastWin = winAmount;

    if (won) {
        game.winner = userId;
        game.winnings = winAmount;
        await game.endGame(userId);

        // Process win
        const user = await User.findById(userId);
        await user.addToBalance(winAmount, 'win');
        user.gamesWon++;
        await user.save();

        // Create win transaction
        const transaction = new Transaction({
            user: userId,
            type: 'win',
            amount: winAmount,
            description: `Ganho na roleta`,
            status: 'completed',
            game: game._id
        });
        await transaction.save();
    } else {
        game.status = 'completed';
        await game.save();
    }
}

// Poker game logic (simplified)
async function processPokerMove(game, userId, move) {
    const { action, amount } = move;
    
    // Simplified poker logic - would need full implementation
    game.gameState.currentAction = action;
    game.gameState.currentPlayer = userId;
    
    // For demo, randomly decide winner after a few moves
    if (game.moves.length >= 4) {
        const players = game.players;
        const winner = players[Math.floor(Math.random() * players.length)];
        const winAmount = game.totalPot * 0.9; // 10% rake
        
        game.winner = winner;
        game.winnings = winAmount;
        await game.endGame(winner);

        // Process win
        const user = await User.findById(winner);
        await user.addToBalance(winAmount, 'win');
        user.gamesWon++;
        await user.save();

        // Create win transaction
        const transaction = new Transaction({
            user: winner,
            type: 'win',
            amount: winAmount,
            description: `Ganho no poker`,
            status: 'completed',
            game: game._id
        });
        await transaction.save();
    } else {
        await game.save();
    }
}

// Blackjack game logic (simplified)
async function processBlackjackMove(game, userId, move) {
    const { action } = move;
    
    // Simplified blackjack logic
    game.gameState.currentAction = action;
    game.gameState.currentPlayer = userId;
    
    // For demo, randomly decide winner after a few moves
    if (game.moves.length >= 3) {
        const players = game.players;
        const winner = players[Math.floor(Math.random() * players.length)];
        const winAmount = game.totalPot * 0.95; // 5% house edge
        
        game.winner = winner;
        game.winnings = winAmount;
        await game.endGame(winner);

        // Process win
        const user = await User.findById(winner);
        await user.addToBalance(winAmount, 'win');
        user.gamesWon++;
        await user.save();

        // Create win transaction
        const transaction = new Transaction({
            user: winner,
            type: 'win',
            amount: winAmount,
            description: `Ganho no blackjack`,
            status: 'completed',
            game: game._id
        });
        await transaction.save();
    } else {
        await game.save();
    }
}

module.exports = router;
