import mongoose from "mongoose";

// 1. User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  position: String,
  role: { type: String, enum: ["admin", "staff", "resident"], default: "resident" },
  email: { type: String, default: "" },
  contactNumber: { type: String, default: "" },
  photo: { type: String, default: "" },
  frameEnabled: { type: Boolean, default: false },
  isActive: { type: Boolean, required: true, default: true } 
}, { timestamps: true });

// 2. Verification Schema
const verificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true },
    contactNumber: String,
    barangayZone: String,
    houseStreetAddress: String,
    validIdType: String,
    idNumber: String,
    idPhotoPath: String, 
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    submittedAt: { type: Date, default: Date.now }
});

// 3. Audit Log Schema
const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  user: String,
  action: String,
  module: String,
  description: String,
  hash: { type: String, unique: true },
  previousHash: String,
}, { timestamps: true });

// 4. Official Schema
const officialSchema = new mongoose.Schema({
  name: String, position: String, committee: String, contact: String, email: String, termStart: String, termEnd: String,
  status: { type: String, default: "Active" }, 
}, { timestamps: true });

// 5. Resident Schema
const residentSchema = new mongoose.Schema({
    firstName: { type: String }, lastName: { type: String }, name: String, age: Number, zone: String,
    status: { type: String, default: "Active" }, contact: String, email: String, address: String,
    civilStatus: String, gender: String, occupation: String, alias: String, is4Ps: Boolean, isFarmer: Boolean
}, { timestamps: true });

// 6. Certificate Schema
const certificateSchema = new mongoose.Schema({
  residentName: String, age: Number, certificateType: String, purpose: String, referenceNo: String,
  dateRequested: String, source: { type: String, default: "Walk-in" }, status: { type: String, default: "Pending" }, filePath: String,
}, { timestamps: true });

// 7. Blotter Schema
const blotterCaseSchema = new mongoose.Schema({
  complainant: String, contactNumber: String, respondent: String, type: { type: String, default: "Incident" },
  location: String, date: String, narrative: String, status: { type: String, default: "Active" }, source: { type: String, default: "Walk-In" } 
}, { timestamps: true });

// 8. Announcement Schema
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" }, 
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },
    primaryTag: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    secondaryTag: { type: String, enum: ['Warning', 'Success', 'Info'], default: 'Info' },
    location: { type: String, default: "Barangay Hall Main Grounds" },
    eventTime: { type: String, default: "8:00 AM - 5:00 PM" },
    organizer: { type: String, default: "Barangay Council" },
    views: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    createdBy: { type: String, default: 'System' },
}, { timestamps: true });

// EXPORT MODELS
export const User = mongoose.model("User", userSchema);
export const Verification = mongoose.model("Verification", verificationSchema);
export const AuditLog = mongoose.model("AuditLog", logSchema);
export const Official = mongoose.model("Official", officialSchema);
export const Resident = mongoose.model("Resident", residentSchema);
export const Certificate = mongoose.model("Certificate", certificateSchema);
export const BlotterCase = mongoose.model("BlotterCase", blotterCaseSchema);
export const Announcement = mongoose.model("Announcement", announcementSchema);