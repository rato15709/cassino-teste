const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['slots', 'poker', 'blackjack', 'roulette', 'baccarat', 'all_games']
    },
    format: {
        type: String,
        required: true,
        enum: ['sit_n_go', 'scheduled', 'freeroll', 'satellite', 'knockout', 'rebuy']
    },
    status: {
        type: String,
        enum: ['announced', 'registration', 'running', 'completed', 'cancelled'],
        default: 'announced'
    },
    startTime: {
        type: Date,
        required: true
    },
    registrationStart: {
        type: Date,
        default: Date.now
    },
    registrationEnd: {
        type: Date
    },
    duration: {
        type: Number, // in minutes
        required: true
    },
    entryFee: {
        type: Number,
        required: true,
        min: 0
    },
    bounty: {
        type: Number,
        default: 0
    },
    prizePool: {
        type: Number,
        required: true
    },
    guaranteedPrizePool: {
        type: Number
    },
    maxParticipants: {
        type: Number,
        required: true,
        min: 2
    },
    minParticipants: {
        type: Number,
        default: 2
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['registered', 'active', 'eliminated', 'disqualified'],
            default: 'registered'
        },
        currentRank: Number,
        finalRank: Number,
        winnings: {
            type: Number,
            default: 0
        },
        chips: {
            type: Number,
            default: 1000
        },
        rebuys: {
            type: Number,
            default: 0
        },
        eliminatedAt: Date,
        eliminatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        statistics: {
            handsPlayed: { type: Number, default: 0 },
            potsWon: { type: Number, default: 0 },
            biggestPot: { type: Number, default: 0 },
            totalWagered: { type: Number, default: 0 }
        }
    }],
    prizeStructure: [{
        rank: {
            type: Number,
            required: true
        },
        prize: {
            type: Number,
            required: true
        },
        percentage: {
            type: Number,
            required: true
        }
    }],
    blinds: {
        small: { type: Number, default: 10 },
        big: { type: Number, default: 20 },
        ante: { type: Number, default: 0 },
        increaseInterval: { type: Number, default: 15 } // minutes
    },
    settings: {
        allowRebuys: { type: Boolean, default: false },
        rebuyCost: { type: Number, default: 0 },
        maxRebuys: { type: Number, default: 0 },
        allowAddons: { type: Boolean, default: false },
        addonCost: { type: Number, default: 0 },
        addonChips: { type: Number, default: 0 },
        lateRegistration: {
            allowed: { type: Boolean, default: false },
            duration: { type: Number, default: 0 } // minutes
        },
        isPrivate: { type: Boolean, default: false },
        password: String,
        level: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced', 'professional'],
            default: 'intermediate'
        }
    },
    currentLevel: {
        type: Number,
        default: 1
    },
    currentRound: {
        type: Number,
        default: 1
    },
    games: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
    }],
    leaderboard: [{
        rank: Number,
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        score: Number,
        chips: Number,
        status: String
    }],
    eliminated: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rank: Number,
        eliminatedAt: Date,
        eliminatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        prize: Number
    }],
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    finalStandings: [{
        rank: Number,
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        prize: Number,
        winnings: Number
    }],
    statistics: {
        totalParticipants: { type: Number, default: 0 },
        totalPrizePool: { type: Number, default: 0 },
        totalRebuys: { type: Number, default: 0 },
        totalAddons: { type: Number, default: 0 },
        averageChips: { type: Number, default: 0 },
        duration: Number,
        handsPlayed: { type: Number, default: 0 }
    },
    stream: {
        isLive: { type: Boolean, default: false },
        streamUrl: String,
        viewers: { type: Number, default: 0 }
    },
    sponsors: [{
        name: String,
        logo: String,
        website: String,
        prizeContribution: Number
    }],
    tags: [String],
    featured: {
        type: Boolean,
        default: false
    },
    completedAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals
tournamentSchema.virtual('isFull').get(function() {
    return this.participants.length >= this.maxParticipants;
});

tournamentSchema.virtual('participantCount').get(function() {
    return this.participants.length;
});

tournamentSchema.virtual('currentPrizePool').get(function() {
    const entryFees = this.participants.length * this.entryFee;
    const rebuys = this.participants.reduce((sum, p) => sum + (p.rebuys * (this.settings.rebuyCost || 0)), 0);
    return entryFees + rebuys + (this.prizePool || 0);
});

tournamentSchema.virtual('isRegistrationOpen').get(function() {
    const now = new Date();
    return this.status === 'registration' && 
           now >= this.registrationStart && 
           (!this.registrationEnd || now <= this.registrationEnd) &&
           !this.isFull;
});

tournamentSchema.virtual('timeToStart').get(function() {
    const now = new Date();
    const diff = this.startTime - now;
    return diff > 0 ? diff : 0;
});

tournamentSchema.virtual('hasStarted').get(function() {
    return ['running', 'completed'].includes(this.status);
});

// Indexes
tournamentSchema.index({ type: 1, status: 1 });
tournamentSchema.index({ startTime: 1 });
tournamentSchema.index({ participants: 1 });
tournamentSchema.index({ winner: 1 });
tournamentSchema.index({ featured: 1 });
tournamentSchema.index({ tags: 1 });
tournamentSchema.index({ createdAt: -1 });

// Middleware
tournamentSchema.pre('save', function(next) {
    // Update statistics
    this.statistics.totalParticipants = this.participants.length;
    this.statistics.totalPrizePool = this.currentPrizePool;
    this.statistics.totalRebuys = this.participants.reduce((sum, p) => sum + p.rebuys, 0);
    
    // Calculate average chips
    if (this.participants.length > 0) {
        this.statistics.averageChips = this.participants.reduce((sum, p) => sum + p.chips, 0) / this.participants.length;
    }
    
    // Auto-update status based on time
    const now = new Date();
    if (now >= this.startTime && this.status === 'registration') {
        this.status = 'running';
    }
    
    next();
});

// Instance methods
tournamentSchema.methods.registerParticipant = function(userId) {
    if (this.isFull) {
        throw new Error('Tournament is full');
    }
    
    if (!this.isRegistrationOpen) {
        throw new Error('Registration is closed');
    }
    
    const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
    if (existingParticipant) {
        throw new Error('User already registered');
    }
    
    this.participants.push({
        user: userId,
        chips: 1000 // Starting chips
    });
    
    return this.save();
};

tournamentSchema.methods.unregisterParticipant = function(userId) {
    const index = this.participants.findIndex(p => p.user.toString() === userId.toString());
    if (index === -1) {
        throw new Error('User not registered');
    }
    
    this.participants.splice(index, 1);
    return this.save();
};

tournamentSchema.methods.eliminateParticipant = function(userId, eliminatedBy = null) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (!participant) {
        throw new Error('Participant not found');
    }
    
    participant.status = 'eliminated';
    participant.eliminatedAt = new Date();
    participant.eliminatedBy = eliminatedBy;
    participant.finalRank = this.participants.filter(p => p.status === 'eliminated').length;
    
    // Add to eliminated array
    this.eliminated.push({
        user: userId,
        rank: participant.finalRank,
        eliminatedAt: new Date(),
        eliminatedBy: eliminatedBy
    });
    
    // Check if tournament is over
    const activeParticipants = this.participants.filter(p => p.status === 'active').length;
    if (activeParticipants <= 1) {
        this.completeTournament();
    }
    
    return this.save();
};

tournamentSchema.methods.addRebuy = function(userId) {
    if (!this.settings.allowRebuys) {
        throw new Error('Rebuys not allowed');
    }
    
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (!participant) {
        throw new Error('Participant not found');
    }
    
    if (participant.rebuys >= this.settings.maxRebuys) {
        throw new Error('Maximum rebuys reached');
    }
    
    participant.rebuys++;
    participant.chips += 1000; // Standard rebuy chips
    
    return this.save();
};

tournamentSchema.methods.updateLeaderboard = function() {
    this.leaderboard = this.participants
        .filter(p => p.status !== 'eliminated')
        .sort((a, b) => b.chips - a.chips)
        .map((p, index) => ({
            rank: index + 1,
            user: p.user,
            score: p.chips,
            chips: p.chips,
            status: p.status
        }));
    
    return this.save();
};

tournamentSchema.methods.completeTournament = function() {
    this.status = 'completed';
    this.completedAt = new Date();
    
    // Determine winner and final standings
    const sortedParticipants = this.participants
        .sort((a, b) => {
            if (a.status === 'eliminated' && b.status === 'eliminated') {
                return a.finalRank - b.finalRank;
            }
            if (a.status === 'eliminated') return 1;
            if (b.status === 'eliminated') return -1;
            return b.chips - a.chips;
        });
    
    this.winner = sortedParticipants[0].user;
    
    this.finalStandings = sortedParticipants.map((p, index) => {
        const prize = this.prizeStructure.find(ps => ps.rank === index + 1);
        return {
            rank: index + 1,
            user: p.user,
            prize: prize ? prize.prize : 0,
            winnings: prize ? prize.prize : 0
        };
    });
    
    return this.save();
};

// Static methods
tournamentSchema.statics.findUpcoming = function(limit = 10) {
    return this.find({
        status: { $in: ['announced', 'registration'] },
        startTime: { $gte: new Date() }
    })
    .populate('participants.user', 'username avatar')
    .sort({ startTime: 1 })
    .limit(limit);
};

tournamentSchema.statics.findActive = function() {
    return this.find({ status: 'running' })
        .populate('participants.user', 'username avatar')
        .sort({ startTime: -1 });
};

tournamentSchema.statics.findCompleted = function(limit = 20) {
    return this.find({ status: 'completed' })
        .populate('winner participants.user', 'username avatar')
        .sort({ completedAt: -1 })
        .limit(limit);
};

tournamentSchema.statics.findByUser = function(userId, status = null) {
    const query = { 'participants.user': userId };
    if (status) {
        query.status = status;
    }
    
    return this.find(query)
        .populate('winner participants.user', 'username avatar')
        .sort({ startTime: -1 });
};

tournamentSchema.statics.getFeatured = function() {
    return this.find({
        featured: true,
        status: { $in: ['announced', 'registration', 'running'] }
    })
    .populate('participants.user', 'username avatar')
    .sort({ startTime: 1 });
};

module.exports = mongoose.model('Tournament', tournamentSchema);
