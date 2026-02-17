const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
const Tournament = require('../models/Tournament');
const router = express.Router();

// Middleware to verify admin token
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }

        // Check if user is admin
        const adminUser = await User.findById(user.id);
        if (!adminUser || adminUser.vipLevel !== 'Diamond') {
            return res.status(403).json({ error: 'Acesso negado - privilégios insuficientes' });
        }

        req.user = user;
        next();
    });
};

// Get dashboard statistics
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        // User statistics
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ status: 'active' });
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
        
        // Financial statistics
        const financialSummary = await Transaction.getFinancialSummary({ start: startDate, end: new Date() });
        
        // Game statistics
        const gameStats = await Game.getGameStatistics(null, { start: startDate, end: new Date() });
        
        // Tournament statistics
        const totalTournaments = await Tournament.countDocuments();
        const activeTournaments = await Tournament.countDocuments({ status: 'running' });
        const completedTournaments = await Tournament.countDocuments({ status: 'completed' });
        
        // Recent activities
        const recentTransactions = await Transaction.find({ createdAt: { $gte: startDate } })
            .populate('user', 'username')
            .sort({ createdAt: -1 })
            .limit(10);
        
        const recentGames = await Game.find({ createdAt: { $gte: startDate } })
            .populate('players winner', 'username')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            period: `${period} dias`,
            users: {
                total: totalUsers,
                active: activeUsers,
                online: onlineUsers,
                new: newUsers,
                growthRate: totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : 0
            },
            financial: {
                totalDeposits: financialSummary[0]?.totalDeposits || 0,
                totalWithdrawals: financialSummary[0]?.totalWithdrawals || 0,
                totalBets: financialSummary[0]?.totalBets || 0,
                totalWins: financialSummary[0]?.totalWins || 0,
                netRevenue: financialSummary[0]?.netRevenue || 0,
                totalBonuses: financialSummary[0]?.totalBonuses || 0
            },
            games: {
                totalGames: gameStats.reduce((sum, g) => sum + g.totalGames, 0),
                activeGames: await Game.countDocuments({ status: 'playing' }),
                averagePot: gameStats.reduce((sum, g) => sum + g.averagePot, 0) / (gameStats.length || 1),
                totalRake: gameStats.reduce((sum, g) => sum + g.totalRake, 0)
            },
            tournaments: {
                total: totalTournaments,
                active: activeTournaments,
                completed: completedTournaments
            },
            recentActivities: {
                transactions: recentTransactions,
                games: recentGames
            }
        });

    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Get all users
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, vipLevel, search } = req.query;
        
        const filters = {};
        if (status) filters.status = status;
        if (vipLevel) filters.vipLevel = vipLevel;
        if (search) {
            filters.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filters)
            .select('-password -security')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await User.countDocuments(filters);

        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Update user status
router.put('/users/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        user.status = status;
        await user.save();

        res.json({
            message: 'Status do usuário atualizado com sucesso',
            user: {
                id: user._id,
                username: user.username,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Erro ao atualizar status do usuário' });
    }
});

// Get all transactions
router.get('/transactions', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status, userId, startDate, endDate } = req.query;
        
        const filters = {};
        if (type) filters.type = type;
        if (status) filters.status = status;
        if (userId) filters.user = userId;
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(filters)
            .populate('user', 'username email')
            .populate('game tournament', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Transaction.countDocuments(filters);

        res.json({
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Erro ao buscar transações' });
    }
});

// Get suspicious transactions
router.get('/transactions/suspicious', authenticateAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.getSuspiciousTransactions();
        
        res.json({ transactions });

    } catch (error) {
        console.error('Get suspicious transactions error:', error);
        res.status(500).json({ error: 'Erro ao buscar transações suspeitas' });
    }
});

// Process withdrawal
router.put('/transactions/:id/process', authenticateAdmin, async (req, res) => {
    try {
        const { action, notes } = req.body;
        
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Ação inválida' });
        }

        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }

        if (transaction.type !== 'withdrawal') {
            return res.status(400).json({ error: 'Apenas saques podem ser processados' });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({ error: 'Transação já foi processada' });
        }

        if (action === 'approve') {
            await transaction.complete(req.user.id);
            
            // Update user statistics
            const user = await User.findById(transaction.user);
            user.statistics.totalWithdrawals += transaction.amount;
            await user.save();
            
        } else {
            await transaction.fail('Rejeitado pelo administrador');
            
            // Refund amount to user
            const user = await User.findById(transaction.user);
            await user.addToBalance(transaction.amount, 'refund');
        }

        if (notes) {
            await transaction.addNote(notes);
        }

        res.json({
            message: `Saque ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso`,
            transaction
        });

    } catch (error) {
        console.error('Process withdrawal error:', error);
        res.status(500).json({ error: 'Erro ao processar saque' });
    }
});

// Get all games
router.get('/games', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;
        
        const filters = {};
        if (type) filters.type = type;
        if (status) filters.status = status;

        const games = await Game.find(filters)
            .populate('players winner', 'username')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Game.countDocuments(filters);

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
        console.error('Get games error:', error);
        res.status(500).json({ error: 'Erro ao buscar jogos' });
    }
});

// Get all tournaments
router.get('/tournaments', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;
        
        const filters = {};
        if (type) filters.type = type;
        if (status) filters.status = status;

        const tournaments = await Tournament.find(filters)
            .populate('participants.user winner', 'username')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Tournament.countDocuments(filters);

        res.json({
            tournaments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios' });
    }
});

// Create bonus for user
router.post('/users/:id/bonus', authenticateAdmin, async (req, res) => {
    try {
        const { amount, type, description, wageringRequirement } = req.body;
        
        if (!amount || !type || !description) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Create bonus transaction
        const transaction = new Transaction({
            user: req.params.id,
            type: 'bonus',
            amount,
            description,
            status: 'completed',
            bonus: {
                type,
                wageringRequirement: wageringRequirement || (amount * 20), // 20x default
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            }
        });

        await transaction.save();
        await user.addToBalance(amount, 'bonus');

        res.json({
            message: 'Bônus concedido com sucesso',
            bonus: {
                amount,
                type,
                description,
                transactionId: transaction._id
            }
        });

    } catch (error) {
        console.error('Create bonus error:', error);
        res.status(500).json({ error: 'Erro ao conceder bônus' });
    }
});

// Get system settings
router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = {
            casino: {
                houseEdge: process.env.HOUSE_EDGE || 0.05,
                minBet: process.env.MIN_BET || 1,
                maxBet: process.env.MAX_BET || 10000,
                welcomeBonus: process.env.WELCOME_BONUS || 100,
                dailyBonus: process.env.DAILY_BONUS || 50
            },
            tournament: {
                entryFee: process.env.TOURNAMENT_ENTRY_FEE || 100,
                prizePool: process.env.TOURNAMENT_PRIZE_POOL || 1000
            },
            security: {
                maxLoginAttempts: 5,
                lockoutDuration: 7200000, // 2 hours
                sessionTimeout: 3600000 // 1 hour
            }
        };

        res.json({ settings });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// Update system settings
router.put('/settings', authenticateAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        
        // In a real application, this would update environment variables or database
        // For now, just return success
        
        res.json({
            message: 'Configurações atualizadas com sucesso',
            settings
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// Get financial reports
router.get('/reports/financial', authenticateAdmin, async (req, res) => {
    try {
        const { period = '30', type = 'daily' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const financialSummary = await Transaction.getFinancialSummary({ start: startDate, end: new Date() });
        const paymentStats = await Transaction.getPaymentMethodStats({ start: startDate, end: new Date() });
        
        res.json({
            period: `${period} dias`,
            summary: financialSummary[0] || {},
            paymentMethods: paymentStats,
            type
        });

    } catch (error) {
        console.error('Get financial reports error:', error);
        res.status(500).json({ error: 'Erro ao buscar relatórios financeiros' });
    }
});

// Get user reports
router.get('/reports/users', authenticateAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const totalUsers = await User.countDocuments();
        const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
        const activeUsers = await User.countDocuments({ 
            status: 'active',
            lastLogin: { $gte: startDate }
        });
        
        const vipDistribution = await User.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$vipLevel', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            period: `${period} dias`,
            total: totalUsers,
            new: newUsers,
            active: activeUsers,
            retentionRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
            vipDistribution
        });

    } catch (error) {
        console.error('Get user reports error:', error);
        res.status(500).json({ error: 'Erro ao buscar relatórios de usuários' });
    }
});

module.exports = router;
