const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Nome de usuário é obrigatório'],
        unique: true,
        trim: true,
        minlength: [3, 'Nome de usuário deve ter pelo menos 3 caracteres'],
        maxlength: [30, 'Nome de usuário deve ter no máximo 30 caracteres']
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    password: {
        type: String,
        required: [true, 'Senha é obrigatória'],
        minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    balance: {
        type: Number,
        default: 1000,
        min: [0, 'Saldo não pode ser negativo']
    },
    totalWinnings: {
        type: Number,
        default: 0
    },
    totalLosses: {
        type: Number,
        default: 0
    },
    gamesPlayed: {
        type: Number,
        default: 0
    },
    gamesWon: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1,
        min: 1
    },
    experience: {
        type: Number,
        default: 0
    },
    vipLevel: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
        default: 'Bronze'
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned'],
        default: 'active'
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    lastLogout: {
        type: Date
    },
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        },
        theme: {
            type: String,
            enum: ['dark', 'light'],
            default: 'dark'
        },
        language: {
            type: String,
            enum: ['pt-BR', 'en-US'],
            default: 'pt-BR'
        },
        soundEffects: { type: Boolean, default: true },
        autoPlay: { type: Boolean, default: false }
    },
    limits: {
        dailyDeposit: { type: Number, default: 5000 },
        dailyWager: { type: Number, default: 10000 },
        sessionTime: { type: Number, default: 240 }, // minutes
        selfExclusion: { type: Boolean, default: false },
        coolingOffPeriod: { type: Date }
    },
    verification: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
        identity: { type: Boolean, default: false },
        emailToken: String,
        phoneToken: String
    },
    security: {
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: String,
        loginAttempts: { type: Number, default: 0 },
        lockUntil: Date,
        passwordResetToken: String,
        passwordResetExpires: Date,
        lastPasswordChange: Date
    },
    affiliate: {
        code: String,
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        commissionEarned: { type: Number, default: 0 }
    },
    bonuses: {
        welcome: { type: Boolean, default: false },
        daily: { type: Date },
        weekly: { type: Date },
        monthly: { type: Date },
        active: [{
            type: { type: String },
            amount: Number,
            wageringRequirement: Number,
            expiresAt: Date,
            used: { type: Boolean, default: false }
        }]
    },
    statistics: {
        totalDeposits: { type: Number, default: 0 },
        totalWithdrawals: { type: Number, default: 0 },
        netProfit: { type: Number, default: 0 },
        averageBet: { type: Number, default: 0 },
        biggestWin: { type: Number, default: 0 },
        biggestLoss: { type: Number, default: 0 },
        favoriteGame: String,
        playTime: { type: Number, default: 0 } // minutes
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals
userSchema.virtual('winRate').get(function() {
    return this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed * 100).toFixed(2) : 0;
});

userSchema.virtual('netBalance').get(function() {
    return this.totalWinnings - this.totalLosses;
});

userSchema.virtual('isLocked').get(function() {
    return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'affiliate.code': 1 });
userSchema.index({ status: 1 });
userSchema.index({ vipLevel: 1 });
userSchema.index({ createdAt: -1 });

// Middleware
userSchema.pre('save', async function(next) {
    // Hash password if modified
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.pre('save', function(next) {
    // Update VIP level based on total wagered
    const totalWagered = this.statistics.totalDeposits;
    
    if (totalWagered >= 100000) {
        this.vipLevel = 'Diamond';
    } else if (totalWagered >= 50000) {
        this.vipLevel = 'Platinum';
    } else if (totalWagered >= 20000) {
        this.vipLevel = 'Gold';
    } else if (totalWagered >= 5000) {
        this.vipLevel = 'Silver';
    } else {
        this.vipLevel = 'Bronze';
    }
    
    next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementLoginAttempts = async function() {
    // If we have a previous lock that has expired, restart at 1
    if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { 'security.lockUntil': 1 },
            $set: { 'security.loginAttempts': 1 }
        });
    }
    
    const updates = { $inc: { 'security.loginAttempts': 1 } };
    
    // Lock account after 5 failed attempts for 2 hours
    if (this.security.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { 'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 };
    }
    
    return this.updateOne(updates);
};

userSchema.methods.addToBalance = function(amount, transactionType = 'bonus') {
    this.balance += amount;
    
    if (amount > 0) {
        this.totalWinnings += amount;
    } else {
        this.totalLosses += Math.abs(amount);
    }
    
    return this.save();
};

userSchema.methods.addExperience = function(amount) {
    this.experience += amount;
    
    // Level up every 1000 experience points
    const newLevel = Math.floor(this.experience / 1000) + 1;
    if (newLevel > this.level) {
        this.level = newLevel;
        // Add level up bonus
        this.balance += newLevel * 10;
    }
    
    return this.save();
};

userSchema.methods.canAfford = function(amount) {
    return this.balance >= amount;
};

userSchema.methods.getDailyBonus = function() {
    const today = new Date();
    const lastDaily = this.bonuses.daily;
    
    if (!lastDaily || today.toDateString() !== lastDaily.toDateString()) {
        this.bonuses.daily = today;
        this.balance += 50; // Daily bonus amount
        return this.save();
    }
    
    throw new Error('Daily bonus already claimed');
};

// Static methods
userSchema.statics.findByUsernameOrEmail = function(identifier) {
    return this.findOne({
        $or: [
            { username: identifier },
            { email: identifier }
        ]
    });
};

userSchema.statics.getLeaderboard = function(limit = 10) {
    return this.find({ status: 'active' })
        .sort({ totalWinnings: -1 })
        .limit(limit)
        .select('username avatar totalWinnings gamesWon vipLevel level');
};

userSchema.statics.getOnlineUsers = function() {
    return this.find({ isOnline: true })
        .select('username avatar isOnline lastLogin')
        .sort({ lastLogin: -1 });
};

module.exports = mongoose.model('User', userSchema);
