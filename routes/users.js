const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
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

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -security.passwordResetToken -security.passwordResetExpires')
            .populate('affiliate.referrals', 'username avatar')
            .populate('affiliate.referredBy', 'username avatar');

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Get recent transactions
        const recentTransactions = await Transaction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('type amount status createdAt');

        // Get game statistics
        const gameStats = await Game.getUserGameHistory(req.user.id, 10);
        const gamesWon = gameStats.filter(g => g.winner && g.winner.toString() === req.user.id).length;

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                balance: user.balance,
                totalWinnings: user.totalWinnings,
                totalLosses: user.totalLosses,
                gamesPlayed: user.gamesPlayed,
                gamesWon: gamesWon,
                level: user.level,
                experience: user.experience,
                vipLevel: user.vipLevel,
                winRate: user.gamesPlayed > 0 ? ((gamesWon / user.gamesPlayed) * 100).toFixed(2) : 0,
                status: user.status,
                isOnline: user.isOnline,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
                preferences: user.preferences,
                limits: user.limits,
                verification: user.verification,
                affiliate: user.affiliate,
                statistics: user.statistics,
                bonuses: user.bonuses
            },
            recentTransactions,
            recentGames: gameStats.slice(0, 5)
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { email, avatar, preferences, limits } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Update email if provided
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email já está em uso' });
            }
            user.email = email;
            user.verification.email = false; // Require re-verification
        }

        // Update avatar if provided
        if (avatar) {
            user.avatar = avatar;
        }

        // Update preferences
        if (preferences) {
            user.preferences = { ...user.preferences, ...preferences };
        }

        // Update limits (with validation)
        if (limits) {
            if (limits.dailyDeposit && limits.dailyDeposit > 0) {
                user.limits.dailyDeposit = limits.dailyDeposit;
            }
            if (limits.dailyWager && limits.dailyWager > 0) {
                user.limits.dailyWager = limits.dailyWager;
            }
            if (limits.sessionTime && limits.sessionTime > 0) {
                user.limits.sessionTime = limits.sessionTime;
            }
            if (typeof limits.selfExclusion === 'boolean') {
                user.limits.selfExclusion = limits.selfExclusion;
                if (limits.selfExclusion) {
                    user.status = 'suspended';
                }
            }
        }

        await user.save();

        res.json({
            message: 'Perfil atualizado com sucesso',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                preferences: user.preferences,
                limits: user.limits
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Upload avatar
router.post('/avatar', authenticateToken, async (req, res) => {
    try {
        // This would handle file upload
        // For now, return a placeholder response
        const user = await User.findById(req.user.id);
        
        // Simulate avatar upload
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
        
        user.avatar = avatarUrl;
        await user.save();

        res.json({
            message: 'Avatar atualizado com sucesso',
            avatar: avatarUrl
        });

    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ error: 'Erro ao fazer upload do avatar' });
    }
});

// Claim daily bonus
router.post('/daily-bonus', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        try {
            await user.getDailyBonus();
            
            // Create bonus transaction
            const transaction = new Transaction({
                user: req.user.id,
                type: 'daily_bonus',
                amount: process.env.DAILY_BONUS || 50,
                description: 'Bônus diário',
                status: 'completed',
                bonus: {
                    type: 'daily',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });

            await transaction.save();

            res.json({
                message: 'Bônus diário claimado com sucesso',
                bonus: process.env.DAILY_BONUS || 50,
                newBalance: user.balance,
                nextBonus: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

        } catch (error) {
            if (error.message.includes('already claimed')) {
                return res.status(400).json({ error: 'Bônus diário já foi claimado hoje' });
            }
            throw error;
        }

    } catch (error) {
        console.error('Daily bonus error:', error);
        res.status(500).json({ error: 'Erro ao claimar bônus diário' });
    }
});

// Get leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        const { type = 'winnings', limit = 10 } = req.query;
        
        let leaderboard;
        
        switch (type) {
            case 'winnings':
                leaderboard = await User.getLeaderboard(parseInt(limit));
                break;
            case 'level':
                leaderboard = await User.find({ status: 'active' })
                    .sort({ level: -1, experience: -1 })
                    .limit(parseInt(limit))
                    .select('username avatar level experience vipLevel');
                break;
            case 'games':
                leaderboard = await User.find({ status: 'active' })
                    .sort({ gamesPlayed: -1 })
                    .limit(parseInt(limit))
                    .select('username avatar gamesPlayed gamesWon vipLevel');
                break;
            default:
                leaderboard = await User.getLeaderboard(parseInt(limit));
        }

        // Find current user's rank
        const currentUser = await User.findById(req.user.id);
        const userRank = await User.countDocuments({
            status: 'active',
            totalWinnings: { $gt: currentUser.totalWinnings }
        }) + 1;

        res.json({
            leaderboard,
            userRank,
            userStats: {
                totalWinnings: currentUser.totalWinnings,
                level: currentUser.level,
                gamesPlayed: currentUser.gamesPlayed
            }
        });

    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Erro ao buscar leaderboard' });
    }
});

// Get user statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const user = await User.findById(req.user.id);
        
        // Get transactions for the period
        const transactions = await Transaction.find({
            user: req.user.id,
            status: 'completed',
            createdAt: { $gte: startDate }
        });

        // Get games for the period
        const games = await Game.find({
            players: req.user.id,
            createdAt: { $gte: startDate }
        });

        const statistics = {
            period: `${period} dias`,
            balance: user.balance,
            totalWinnings: user.totalWinnings,
            totalLosses: user.totalLosses,
            netProfit: user.totalWinnings - user.totalLosses,
            gamesPlayed: user.gamesPlayed,
            gamesWon: games.filter(g => g.winner && g.winner.toString() === req.user.id).length,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(2) : 0,
            level: user.level,
            experience: user.experience,
            vipLevel: user.vipLevel,
            transactions: {
                total: transactions.length,
                deposits: transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
                withdrawals: transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
                bonuses: transactions.filter(t => t.type === 'bonus').reduce((sum, t) => sum + t.amount, 0)
            },
            gameStats: {
                totalGames: games.length,
                favoriteGame: getFavoriteGame(games),
                averageBet: games.length > 0 ? games.reduce((sum, g) => sum + g.betAmount, 0) / games.length : 0,
                biggestWin: user.statistics.biggestWin,
                playTime: user.statistics.playTime
            }
        };

        res.json({ statistics });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Get user referrals
router.get('/referrals', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('affiliate.referrals', 'username avatar createdAt balance')
            .populate('affiliate.referredBy', 'username avatar');

        const referralStats = {
            totalReferrals: user.affiliate.referrals.length,
            activeReferrals: user.affiliate.referrals.filter(r => r.balance > 0).length,
            commissionEarned: user.affiliate.commissionEarned,
            referralCode: user.affiliate.code || generateReferralCode(user.username)
        };

        res.json({
            referrals: user.affiliate.referrals,
            referredBy: user.affiliate.referredBy,
            stats: referralStats
        });

    } catch (error) {
        console.error('Get referrals error:', error);
        res.status(500).json({ error: 'Erro ao buscar indicações' });
    }
});

// Generate referral code
function generateReferralCode(username) {
    return username.toUpperCase().substring(0, 3) + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get online users
router.get('/online', authenticateToken, async (req, res) => {
    try {
        const onlineUsers = await User.getOnlineUsers();
        
        res.json({
            onlineUsers: onlineUsers.map(user => ({
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                isOnline: user.isOnline,
                lastLogin: user.lastLogin
            })),
            totalOnline: onlineUsers.length
        });

    } catch (error) {
        console.error('Get online users error:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários online' });
    }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Query de busca deve ter pelo menos 2 caracteres' });
        }

        const users = await User.find({
            username: { $regex: q, $options: 'i' },
            status: 'active'
        })
        .select('username avatar level vipLevel')
        .limit(parseInt(limit));

        res.json({ users });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Get user by ID (public profile)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('username avatar level experience vipLevel gamesPlayed gamesWon totalWinnings createdAt')
            .populate('affiliate.referrals', 'username avatar');

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Check if user is private
        if (user.preferences && user.preferences.privateProfile) {
            return res.status(403).json({ error: 'Perfil privado' });
        }

        const publicProfile = {
            id: user._id,
            username: user.username,
            avatar: user.avatar,
            level: user.level,
            experience: user.experience,
            vipLevel: user.vipLevel,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            totalWinnings: user.totalWinnings,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(2) : 0,
            memberSince: user.createdAt,
            referrals: user.affiliate.referrals.length
        };

        res.json({ user: publicProfile });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// Helper function to get favorite game
function getFavoriteGame(games) {
    const gameCounts = {};
    games.forEach(game => {
        gameCounts[game.type] = (gameCounts[game.type] || 0) + 1;
    });
    
    return Object.keys(gameCounts).reduce((a, b) => 
        gameCounts[a] > gameCounts[b] ? a : b, '');
}

module.exports = router;
