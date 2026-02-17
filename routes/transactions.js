const express = require('express');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
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

// Get user transactions
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;
        
        const filters = {};
        if (type) filters.type = type;
        if (status) filters.status = status;
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.getUserTransactions(req.user.id, {
            ...filters,
            limit: parseInt(limit)
        });

        const total = await Transaction.countDocuments({ user: req.user.id, ...filters });

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

// Create deposit transaction
router.post('/deposit', authenticateToken, async (req, res) => {
    try {
        const { amount, paymentMethod, paymentDetails } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valor do depósito deve ser maior que zero' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ error: 'Método de pagamento é obrigatório' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Check daily deposit limit
        const today = new Date();
        const todayTransactions = await Transaction.find({
            user: req.user.id,
            type: 'deposit',
            status: 'completed',
            createdAt: {
                $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
            }
        });

        const todayTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
        if (todayTotal + amount > user.limits.dailyDeposit) {
            return res.status(400).json({ error: 'Limite diário de depósito excedido' });
        }

        // Create transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'deposit',
            amount,
            paymentMethod,
            paymentDetails,
            description: `Depósito de R$ ${amount.toFixed(2)}`,
            status: 'pending',
            metadata: {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        await transaction.save();

        // Simulate payment processing
        setTimeout(async () => {
            try {
                // Simulate payment gateway response
                const paymentSuccess = Math.random() > 0.1; // 90% success rate
                
                if (paymentSuccess) {
                    transaction.status = 'completed';
                    transaction.completedAt = new Date();
                    transaction.paymentDetails = {
                        ...transaction.paymentDetails,
                        transactionId: `PAY_${Date.now()}`,
                        authorizationCode: `AUTH_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
                    };
                    
                    await transaction.save();
                    await user.addToBalance(amount, 'deposit');
                    
                    // Update user statistics
                    user.statistics.totalDeposits += amount;
                    await user.save();
                    
                } else {
                    transaction.status = 'failed';
                    transaction.failureReason = 'Pagamento recusado pela instituição financeira';
                    await transaction.save();
                }
            } catch (error) {
                console.error('Payment processing error:', error);
                transaction.status = 'failed';
                transaction.failureReason = 'Erro interno no processamento';
                await transaction.save();
            }
        }, 3000); // 3 seconds processing time

        res.status(201).json({
            message: 'Solicitação de depósito criada',
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                status: transaction.status,
                reference: transaction.reference
            }
        });

    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Erro ao processar depósito' });
    }
});

// Create withdrawal transaction
router.post('/withdrawal', authenticateToken, async (req, res) => {
    try {
        const { amount, paymentMethod, paymentDetails } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valor do saque deve ser maior que zero' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ error: 'Método de pagamento é obrigatório' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!user.canAfford(amount)) {
            return res.status(400).json({ error: 'Saldo insuficiente' });
        }

        // Check minimum withdrawal amount
        const minWithdrawal = 50; // R$ 50 minimum
        if (amount < minWithdrawal) {
            return res.status(400).json({ error: `Valor mínimo de saque é R$ ${minWithdrawal}` });
        }

        // Create transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'withdrawal',
            amount,
            paymentMethod,
            paymentDetails,
            description: `Saque de R$ ${amount.toFixed(2)}`,
            status: 'pending',
            metadata: {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        await transaction.save();

        // Deduct amount from user balance immediately
        await user.addToBalance(-amount, 'withdrawal');

        // Simulate withdrawal processing
        setTimeout(async () => {
            try {
                // Simulate payment gateway response
                const paymentSuccess = Math.random() > 0.05; // 95% success rate
                
                if (paymentSuccess) {
                    transaction.status = 'completed';
                    transaction.completedAt = new Date();
                    transaction.paymentDetails = {
                        ...transaction.paymentDetails,
                        transactionId: `WTH_${Date.now()}`,
                        authorizationCode: `WTH_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
                    };
                    
                    await transaction.save();
                    
                    // Update user statistics
                    user.statistics.totalWithdrawals += amount;
                    await user.save();
                    
                } else {
                    transaction.status = 'failed';
                    transaction.failureReason = 'Saque recusado pela instituição financeira';
                    await transaction.save();
                    
                    // Refund amount to user balance
                    await user.addToBalance(amount, 'refund');
                }
            } catch (error) {
                console.error('Withdrawal processing error:', error);
                transaction.status = 'failed';
                transaction.failureReason = 'Erro interno no processamento';
                await transaction.save();
                
                // Refund amount to user balance
                await user.addToBalance(amount, 'refund');
            }
        }, 5000); // 5 seconds processing time

        res.status(201).json({
            message: 'Solicitação de saque criada',
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                status: transaction.status,
                reference: transaction.reference
            }
        });

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Erro ao processar saque' });
    }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate('game tournament');

        if (!transaction) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }

        res.json({ transaction });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Erro ao buscar transação' });
    }
});

// Cancel pending transaction
router.put('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: req.user.id,
            status: 'pending'
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transação não encontrada ou não pode ser cancelada' });
        }

        await transaction.cancel('Cancelado pelo usuário');

        // Refund amount if it was a withdrawal
        if (transaction.type === 'withdrawal') {
            const user = await User.findById(req.user.id);
            await user.addToBalance(transaction.amount, 'refund');
        }

        res.json({ message: 'Transação cancelada com sucesso' });

    } catch (error) {
        console.error('Cancel transaction error:', error);
        res.status(500).json({ error: 'Erro ao cancelar transação' });
    }
});

// Get user balance summary
router.get('/balance/summary', authenticateToken, async (req, res) => {
    try {
        const balanceData = await Transaction.getUserBalance(req.user.id);
        
        let summary = {
            balance: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalWinnings: 0,
            totalBonuses: 0
        };

        if (balanceData.length > 0) {
            summary = balanceData[0];
        }

        res.json({ summary });

    } catch (error) {
        console.error('Balance summary error:', error);
        res.status(500).json({ error: 'Erro ao buscar resumo de saldo' });
    }
});

// Get payment methods
router.get('/payment-methods', (req, res) => {
    const paymentMethods = [
        {
            id: 'credit_card',
            name: 'Cartão de Crédito',
            description: 'Visa, Mastercard, Elo',
            fees: 2.5,
            minAmount: 10,
            maxAmount: 10000,
            processingTime: 'Instantâneo'
        },
        {
            id: 'debit_card',
            name: 'Cartão de Débito',
            description: 'Visa, Mastercard, Elo',
            fees: 1.5,
            minAmount: 10,
            maxAmount: 5000,
            processingTime: 'Instantâneo'
        },
        {
            id: 'bank_transfer',
            name: 'Transferência Bancária',
            description: 'TED, DOC',
            fees: 0,
            minAmount: 50,
            maxAmount: 50000,
            processingTime: '1-2 dias úteis'
        },
        {
            id: 'pix',
            name: 'PIX',
            description: 'Transferência instantânea',
            fees: 0,
            minAmount: 10,
            maxAmount: 100000,
            processingTime: 'Instantâneo'
        },
        {
            id: 'paypal',
            name: 'PayPal',
            description: 'Pagamento online',
            fees: 3.5,
            minAmount: 10,
            maxAmount: 8000,
            processingTime: 'Instantâneo'
        }
    ];

    res.json({ paymentMethods });
});

// Get transaction statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const transactions = await Transaction.find({
            user: req.user.id,
            status: 'completed',
            createdAt: { $gte: startDate }
        });

        const statistics = {
            totalTransactions: transactions.length,
            totalDeposits: transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
            totalWithdrawals: transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
            totalWinnings: transactions.filter(t => t.type === 'win').reduce((sum, t) => sum + t.amount, 0),
            totalBonuses: transactions.filter(t => t.type === 'bonus').reduce((sum, t) => sum + t.amount, 0),
            averageTransaction: transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length,
            mostUsedMethod: null
        };

        // Find most used payment method
        const methodCounts = {};
        transactions.forEach(t => {
            if (t.paymentMethod) {
                methodCounts[t.paymentMethod] = (methodCounts[t.paymentMethod] || 0) + 1;
            }
        });
        
        statistics.mostUsedMethod = Object.keys(methodCounts).reduce((a, b) => 
            methodCounts[a] > methodCounts[b] ? a : b, '');

        res.json({ statistics });

    } catch (error) {
        console.error('Transaction statistics error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

module.exports = router;
