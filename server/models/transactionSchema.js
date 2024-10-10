const mongoose = require("mongoose");
const transactionSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transactionType: {
      type: String,
      enum: ['purchase', 'credit'],
      required: true,
    },
    amount: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    }
  }, { timestamps: true });
  
  module.exports = mongoose.model('Transaction', transactionSchema);
  