const express = require('express');
const Tournament = require('../models/Tournament');
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

// Get upcoming tournaments
router.get('/upcoming', authenticateToken, async (req, res) => {
    try {
        const { type, limit = 10 } = req.query;
        
        let query = {};
        if (type) {
            query.type = type;
        }

        const tournaments = await Tournament.findUpcoming(parseInt(limit));
        
        res.json({ tournaments });

    } catch (error) {
        console.error('Get upcoming tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios futuros' });
    }
});

// Get active tournaments
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const tournaments = await Tournament.findActive();
        
        res.json({ tournaments });

    } catch (error) {
        console.error('Get active tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios ativos' });
    }
});

// Get completed tournaments
router.get('/completed', authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        
        const tournaments = await Tournament.findCompleted(parseInt(limit));
        
        res.json({ tournaments });

    } catch (error) {
        console.error('Get completed tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios concluídos' });
    }
});

// Get tournament details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('participants.user', 'username avatar level vipLevel')
            .populate('winner', 'username avatar')
            .populate('eliminated.user', 'username avatar');

        if (!tournament) {
            return res.status(404).json({ error: 'Torneio não encontrado' });
        }

        // Check if user is registered
        const isRegistered = tournament.participants.some(p => p.user._id.toString() === req.user.id);

        res.json({
            tournament,
            isRegistered,
            canRegister: tournament.isRegistrationOpen && !isRegistered && !tournament.isFull
        });

    } catch (error) {
        console.error('Get tournament error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneio' });
    }
});

// Register for tournament
router.post('/:id/register', authenticateToken, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({ error: 'Torneio não encontrado' });
        }

        if (!tournament.isRegistrationOpen) {
            return res.status(400).json({ error: 'Inscrições não estão abertas' });
        }

        if (tournament.isFull) {
            return res.status(400).json({ error: 'Torneio está cheio' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!user.canAfford(tournament.entryFee)) {
            return res.status(400).json({ error: 'Saldo insuficiente para a taxa de inscrição' });
        }

        // Check if already registered
        const isRegistered = tournament.participants.some(p => p.user.toString() === req.user.id);
        if (isRegistered) {
            return res.status(400).json({ error: 'Usuário já está inscrito' });
        }

        // Register user
        await tournament.registerParticipant(req.user.id);

        // Create tournament entry transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'tournament_entry',
            amount: tournament.entryFee,
            description: `Inscrição no torneio ${tournament.name}`,
            status: 'completed',
            tournament: tournament._id
        });

        await transaction.save();
        await user.addToBalance(-tournament.entryFee, 'tournament_entry');

        // Update tournament prize pool
        tournament.prizePool += tournament.entryFee;
        await tournament.save();

        res.json({
            message: 'Inscrição realizada com sucesso',
            tournament: await tournament.populate('participants.user', 'username avatar')
        });

    } catch (error) {
        console.error('Register tournament error:', error);
        res.status(500).json({ error: 'Erro ao se inscrever no torneio' });
    }
});

// Unregister from tournament
router.post('/:id/unregister', authenticateToken, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id);

        if (!tournament) {
            return res.status(404).json({ error: 'Torneio não encontrado' });
        }

        if (tournament.hasStarted) {
            return res.status(400).json({ error: 'Não é possível cancelar inscrição após o início do torneio' });
        }

        await tournament.unregisterParticipant(req.user.id);

        // Refund entry fee
        const user = await User.findById(req.user.id);
        await user.addToBalance(tournament.entryFee, 'refund');

        // Create refund transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'refund',
            amount: tournament.entryFee,
            description: `Reembolso - cancelamento inscrição torneio ${tournament.name}`,
            status: 'completed',
            tournament: tournament._id
        });

        await transaction.save();

        res.json({ message: 'Inscrição cancelada com sucesso' });

    } catch (error) {
        console.error('Unregister tournament error:', error);
        res.status(500).json({ error: 'Erro ao cancelar inscrição' });
    }
});

// Get tournament leaderboard
router.get('/:id/leaderboard', authenticateToken, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('leaderboard.user', 'username avatar level vipLevel')
            .populate('eliminated.user', 'username avatar');

        if (!tournament) {
            return res.status(404).json({ error: 'Torneio não encontrado' });
        }

        // Check if user is participant
        const isParticipant = tournament.participants.some(p => p.user.toString() === req.user.id);
        if (!isParticipant && tournament.status !== 'completed') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        res.json({
            leaderboard: tournament.leaderboard,
            eliminated: tournament.eliminated,
            currentPrizePool: tournament.currentPrizePool,
            status: tournament.status
        });

    } catch (error) {
        console.error('Get tournament leaderboard error:', error);
        res.status(500).json({ error: 'Erro ao buscar leaderboard' });
    }
});

// Get user tournaments
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const { status, limit = 20 } = req.query;
        
        const tournaments = await Tournament.findByUser(req.params.userId, status);
        
        res.json({ tournaments });

    } catch (error) {
        console.error('Get user tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios do usuário' });
    }
});

// Create tournament (admin only)
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            description,
            type,
            format,
            startTime,
            duration,
            entryFee,
            maxParticipants,
            prizeStructure,
            settings
        } = req.body;

        // Validate required fields
        if (!name || !description || !type || !format || !startTime || !duration || !entryFee || !maxParticipants) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        // Check if user is admin (simplified)
        const user = await User.findById(req.user.id);
        if (user.vipLevel !== 'Diamond') {
            return res.status(403).json({ error: 'Apenas administradores podem criar torneios' });
        }

        // Calculate prize pool
        const guaranteedPrizePool = entryFee * maxParticipants;

        const tournament = new Tournament({
            name,
            description,
            type,
            format,
            startTime: new Date(startTime),
            duration,
            entryFee,
            maxParticipants,
            prizePool: guaranteedPrizePool,
            guaranteedPrizePool,
            prizeStructure: prizeStructure || generatePrizeStructure(maxParticipants, guaranteedPrizePool),
            settings: {
                ...settings,
                allowRebuys: settings.allowRebuys || false,
                allowAddons: settings.allowAddons || false,
                lateRegistration: settings.lateRegistration || { allowed: false, duration: 0 }
            }
        });

        await tournament.save();

        res.status(201).json({
            message: 'Torneio criado com sucesso',
            tournament
        });

    } catch (error) {
        console.error('Create tournament error:', error);
        res.status(500).json({ error: 'Erro ao criar torneio' });
    }
});

// Get featured tournaments
router.get('/featured/all', authenticateToken, async (req, res) => {
    try {
        const tournaments = await Tournament.getFeatured();
        
        res.json({ tournaments });

    } catch (error) {
        console.error('Get featured tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios em destaque' });
    }
});

// Helper function to generate prize structure
function generatePrizeStructure(maxParticipants, prizePool) {
    const structure = [];
    const percentage = [0.5, 0.3, 0.15, 0.05]; // 50%, 30%, 15%, 5%
    
    const numWinners = Math.min(4, Math.floor(maxParticipants / 2));
    
    for (let i = 0; i < numWinners; i++) {
        structure.push({
            rank: i + 1,
            prize: Math.floor(prizePool * percentage[i]),
            percentage: percentage[i] * 100
        });
    }
    
    return structure;
}

module.exports = router;
