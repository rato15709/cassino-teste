const express = require('express');
const jwt = require('jsonwebtoken');
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

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, affiliateCode } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: existingUser.username === username ? 'Nome de usuário já existe' : 'Email já cadastrado' 
            });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password,
            affiliate: { code: affiliateCode }
        });

        await user.save();

        // Handle affiliate code if provided
        if (affiliateCode) {
            const referrer = await User.findOne({ 'affiliate.code': affiliateCode });
            if (referrer) {
                referrer.affiliate.referrals.push(user._id);
                await referrer.save();
                
                user.affiliate.referredBy = referrer._id;
                await user.save();
            }
        }

        // Create welcome bonus transaction
        const welcomeTransaction = new Transaction({
            user: user._id,
            type: 'welcome_bonus',
            amount: process.env.WELCOME_BONUS || 100,
            description: 'Bônus de boas-vindas',
            status: 'completed',
            bonus: {
                type: 'welcome',
                wageringRequirement: 2000, // 20x wagering
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            }
        });

        await welcomeTransaction.save();
        await user.addToBalance(process.env.WELCOME_BONUS || 100);

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Update user login info
        user.lastLogin = new Date();
        user.isOnline = true;
        await user.save();

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                level: user.level,
                vipLevel: user.vipLevel
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
        }

        // Find user by username or email
        const user = await User.findByUsernameOrEmail(username);

        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Check if account is locked
        if (user.isLocked) {
            return res.status(423).json({ 
                error: 'Conta bloqueada. Tente novamente mais tarde.' 
            });
        }

        // Check account status
        if (user.status !== 'active') {
            return res.status(403).json({ 
                error: 'Conta suspensa ou banida' 
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            await user.incrementLoginAttempts();
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Reset login attempts on successful login
        if (user.security.loginAttempts > 0) {
            user.security.loginAttempts = 0;
            user.security.lockUntil = undefined;
        }

        // Update login info
        user.lastLogin = new Date();
        user.isOnline = true;
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Check for daily bonus
        let dailyBonusAvailable = false;
        try {
            await user.getDailyBonus();
            dailyBonusAvailable = true;
        } catch (error) {
            // Daily bonus already claimed
        }

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                level: user.level,
                vipLevel: user.vipLevel,
                dailyBonusAvailable
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user) {
            user.isOnline = false;
            user.lastLogout = new Date();
            await user.save();
        }

        res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Erro ao fazer logout' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -security.passwordResetToken -security.passwordResetExpires');

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Check for daily bonus
        let dailyBonusAvailable = false;
        try {
            await user.getDailyBonus();
            dailyBonusAvailable = true;
        } catch (error) {
            // Daily bonus already claimed
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                totalWinnings: user.totalWinnings,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                level: user.level,
                experience: user.experience,
                vipLevel: user.vipLevel,
                winRate: user.winRate,
                dailyBonusAvailable,
                preferences: user.preferences,
                verification: user.verification,
                statistics: user.statistics
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Erro ao obter informações do usuário' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { email, preferences } = req.body;
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

        // Update preferences
        if (preferences) {
            user.preferences = { ...user.preferences, ...preferences };
        }

        await user.save();

        res.json({
            message: 'Perfil atualizado com sucesso',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                preferences: user.preferences
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        // Update password
        user.password = newPassword;
        user.security.lastPasswordChange = new Date();
        await user.save();

        res.json({ message: 'Senha alterada com sucesso' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'Email não encontrado' });
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2, 15);
        user.security.passwordResetToken = resetToken;
        user.security.passwordResetExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // TODO: Send email with reset link
        console.log(`Password reset token for ${email}: ${resetToken}`);

        res.json({ message: 'Email de redefinição de senha enviado' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const user = await User.findOne({
            'security.passwordResetToken': token,
            'security.passwordResetExpires': { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        // Update password
        user.password = newPassword;
        user.security.passwordResetToken = undefined;
        user.security.passwordResetExpires = undefined;
        user.security.lastPasswordChange = new Date();
        await user.save();

        res.json({ message: 'Senha redefinida com sucesso' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Generate new token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.json({ token });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Erro ao atualizar token' });
    }
});

module.exports = router;
