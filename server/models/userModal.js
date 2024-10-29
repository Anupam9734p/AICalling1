const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    credits: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user",
    },
    profileImage: {
      buffer: Buffer,
      contentType: String,
      originalName: String,
    },

    demoCall: {
      type: Number,
      default: 0,
    },
    twilioToken: {
      type: String,
      default: "",
    },
    twilioSid: {
      type: String,
      default: "",
    },
    twilioNum: {
      type: String,
      default: "",
    },
    vapiPhoneNumberId: {
      type: String,
      default: "",
    },
    vapiSipUri: {
      type: String,
      default: "",
    },
    sendGridApiKey:{
      type:String,
      default:""
    },
    sendGridEmail:{
      type:String,
      default:""
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
    
    subUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubUser",
      },
    ],
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
