const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const subUserSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    credit: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      default: "subuser",
    },
    resetToken: {
      type: String,
    },
    resetTokenExpiry: {
      type: String,
    },
    totalCredit:{
       type:Number,
    },
    mainCount: [
      {
        count: {
          type: Number,
          default: 0
        },
        date: {
          type: Date,
          default: Date.now
        }
      }
    ],
    
    profileImage: {
      buffer: Buffer,
      contentType: String,
      originalName: String,
    },
  },
  { timestamps: true }
);

subUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("SubUser", subUserSchema);
