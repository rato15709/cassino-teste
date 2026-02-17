const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'deposit',
            'withdrawal',
            'bet',
            'win',
            'bonus',
            'refund',
            'fee',
            'rakeback',
            'affiliate_payment',
            'tournament_entry',
            'tournament_winnings',
            'daily_bonus',
            'welcome_bonus',
            'level_up_bonus',
            'adjustment'
        ]
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'BRL',
        enum: ['BRL', 'USD', 'EUR']
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
        default: 'pending'
    },
    description: {
        type: String,
        required: true
    },
    reference: {
        type: String,
        unique: true,
        sparse: true
    },
    game: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
    },
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament'
    },
    paymentMethod: {
        type: String,
        enum: [
            'credit_card',
            'debit_card',
            'bank_transfer',
            'pix',
            'paypal',
            'skrill',
            'neteller',
            'crypto',
            'internal'
        ]
    },
    paymentDetails: {
        gateway: String,
        transactionId: String,
        authorizationCode: String,
        processor: String,
        fee: Number,
        exchangeRate: Number
    },
    metadata: {
        ip: String,
        userAgent: String,
        location: {
            country: String,
            city: String,
            coordinates: [Number]
        },
        device: String,
        browser: String
    },
    bonus: {
        type: {
            type: String,
            enum: ['welcome', 'deposit', 'no_deposit', 'free_spins', 'cashback', 'reload']
        },
        wageringRequirement: Number,
        wageringProgress: Number,
        expiresAt: Date,
        claimedAt: Date
    },
    flags: {
        isHighValue: { type: Boolean, default: false },
        isSuspicious: { type: Boolean, default: false },
        requiresManualReview: { type: Boolean, default: false },
        isRecurring: { type: Boolean, default: false }
    },
    relatedTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: String,
    failureReason: String,
    completedAt: Date,
    expiresAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals
transactionSchema.virtual('isPositive').get(function() {
    return ['deposit', 'win', 'bonus', 'refund', 'rakeback', 'affiliate_payment', 'tournament_winnings', 'daily_bonus', 'welcome_bonus', 'level_up_bonus'].includes(this.type);
});

transactionSchema.virtual('isCompleted').get(function() {
    return this.status === 'completed';
});

transactionSchema.virtual('isPending').get(function() {
    return this.status === 'pending';
});

transactionSchema.virtual('formattedAmount').get(function() {
    const prefix = this.isPositive ? '+' : '-';
    return `${prefix} R$ ${Math.abs(this.amount).toFixed(2)}`;
});

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ paymentMethod: 1 });
transactionSchema.index({ 'flags.isSuspicious': 1 });
transactionSchema.index({ 'flags.requiresManualReview': 1 });

// Middleware
transactionSchema.pre('save', function(next) {
    // Generate unique reference if not provided
    if (!this.reference) {
        this.reference = this.generateReference();
    }
    
    // Set completion time
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    
    // Flag high-value transactions
    if (Math.abs(this.amount) >= 10000) {
        this.flags.isHighValue = true;
        this.flags.requiresManualReview = true;
    }
    
    next();
});

// Instance methods
transactionSchema.methods.generateReference = function() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TXN-${timestamp}-${random}`.toUpperCase();
};

transactionSchema.methods.complete = function(processedBy = null) {
    this.status = 'completed';
    this.completedAt = new Date();
    if (processedBy) {
        this.processedBy = processedBy;
    }
    return this.save();
};

transactionSchema.methods.fail = function(reason) {
    this.status = 'failed';
    this.failureReason = reason;
    return this.save();
};

transactionSchema.methods.cancel = function(reason) {
    this.status = 'cancelled';
    this.failureReason = reason;
    return this.save();
};

transactionSchema.methods.addNote = function(note) {
    this.notes = note;
    return this.save();
};

transactionSchema.methods.updateWageringProgress = function(amount) {
    if (this.bonus && this.bonus.wageringRequirement > 0) {
        this.bonus.wageringProgress = Math.min(
            this.bonus.wageringProgress + amount,
            this.bonus.wageringRequirement
        );
        return this.save();
    }
};

// Static methods
transactionSchema.statics.getUserTransactions = function(userId, filters = {}) {
    const query = { user: userId };
    
    if (filters.type) {
        query.type = filters.type;
    }
    
    if (filters.status) {
        query.status = filters.status;
    }
    
    if (filters.dateRange) {
        query.createdAt = {
            $gte: filters.dateRange.start,
            $lte: filters.dateRange.end
        };
    }
    
    return this.find(query)
        .populate('game tournament')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50);
};

transactionSchema.statics.getUserBalance = function(userId) {
    return this.aggregate([
        { $match: { user: mongoose.Types.ObjectId(userId), status: 'completed' } },
        {
            $group: {
                _id: '$user',
                balance: {
                    $sum: {
                        $cond: [
                            {
                                $in: [
                                    '$type',
                                    ['deposit', 'win', 'bonus', 'refund', 'rakeback', 'affiliate_payment', 'tournament_winnings', 'daily_bonus', 'welcome_bonus', 'level_up_bonus']
                                ]
                            },
                            '$amount',
                            { $multiply: ['$amount', -1] }
                        ]
                    }
                },
                totalDeposits: {
                    $sum: {
                        $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0]
                    }
                },
                totalWithdrawals: {
                    $sum: {
                        $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0]
                    }
                },
                totalWinnings: {
                    $sum: {
                        $cond: [{ $eq: ['$type', 'win'] }, '$amount', 0]
                    }
                },
                totalBonuses: {
                    $sum: {
                        $cond: [{ $eq: ['$type', 'bonus'] }, '$amount', 0]
                    }
                }
            }
        }
    ]);
};

transactionSchema.statics.getFinancialSummary = function(dateRange = null) {
    const matchStage = { status: 'completed' };
    
    if (dateRange) {
        matchStage.createdAt = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalDeposits: {
                    $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
                },
                totalWithdrawals: {
                    $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
                },
                totalBets: {
                    $sum: { $cond: [{ $eq: ['$type', 'bet'] }, '$amount', 0] }
                },
                totalWins: {
                    $sum: { $cond: [{ $eq: ['$type', 'win'] }, '$amount', 0] }
                },
                totalBonuses: {
                    $sum: { $cond: [{ $eq: ['$type', 'bonus'] }, '$amount', 0] }
                },
                netRevenue: {
                    $sum: {
                        $cond: [
                            { $in: ['$type', ['deposit', 'bet']] },
                            '$amount',
                            { $multiply: ['$amount', -1] }
                        ]
                    }
                },
                transactionCount: { $sum: 1 },
                averageTransaction: { $avg: '$amount' }
            }
        }
    ]);
};

transactionSchema.statics.getSuspiciousTransactions = function() {
    return this.find({
        $or: [
            { 'flags.isSuspicious': true },
            { 'flags.requiresManualReview': true },
            { amount: { $gte: 50000 } },
            { status: 'failed' }
        ]
    })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });
};

transactionSchema.statics.getPaymentMethodStats = function(dateRange = null) {
    const matchStage = { status: 'completed' };
    
    if (dateRange) {
        matchStage.createdAt = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                averageAmount: { $avg: '$amount' },
                successRate: {
                    $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        },
        { $sort: { totalAmount: -1 } }
    ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);
