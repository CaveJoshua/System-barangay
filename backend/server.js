
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import helmet from "helmet";
// FIX 1: Removed invalid 'ipKeyGenerator' import
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Initialize Environment Variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_change_in_prod"; 

/**
 * ============================================================================
 * 1. CONFIGURATION & CONSTANTS
 * ============================================================================
 */

// SECURITY MAP: Maps secure environment variables to roles.
// Users must provide the specific 'signupKey' matching these values to get the role.
const SIGNUP_KEYS = { 
    [process.env.KEY_ADMIN]: "admin", 
    [process.env.KEY_STAFF]: "staff", 
    [process.env.KEY_RESIDENT]: "resident" 
};

// ============================================================================
// 2. DATABASE CONNECTION
// ============================================================================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ [DB] MongoDB Connected Successfully"))
  .catch((err) => {
      console.error("❌ [DB] Connection Error:", err);
      process.exit(1); // Exit process on DB failure
  });

// ============================================================================
// 3. CLOUDINARY STORAGE ENGINE
// ============================================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barangay-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [
        { width: 1080, crop: "limit" }, 
        { quality: "auto" }, 
        { fetch_format: "auto" }
    ]
  },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Optimized: Increased limit to 5MB for modern cameras
});

// ============================================================================
// 4. EMAIL SERVICE (Nodemailer)
// ============================================================================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Helper to send formatted emails.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 */
const sendEmail = async (to, subject, htmlContent) => {
  try {
    if (!to) return; 
    const mailOptions = {
      from: `"Barangay Tugui Grande" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };
    await transporter.sendMail(mailOptions);
    console.log(`📧 [EMAIL] Sent successfully to ${to}`);
  } catch (error) {
    console.error("❌ [EMAIL] Sending Failed:", error.message);
  }
};

// ============================================================================
// 5. GLOBAL MIDDLEWARE & SECURITY
// ============================================================================

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// --- UPDATED CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://a6d926ad.tuguigrande.pages.dev' // <--- ADD YOUR CLOUDFLARE URL HERE
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Optimized: Increased payload limit for Base64 images if needed
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// -----------------------------
// RATE LIMITING STRATEGIES
// -----------------------------

// General API Limiter (DDoS Protection)
const apiLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    // FIX 2: Removed keyGenerator (defaults to IP automatically)
});
app.use("/api/", apiLimiter);

/**
 * Middleware to check if user is Admin or Staff to skip rate limits.
 * @param {Request} req 
 * @returns {boolean}
 */
const skipIfAdmin = (req) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return ["admin", "staff"].includes(decoded.role);
        } catch (e) { return false; }
    }
    return false; 
};

// Specific Limiter for Blotter Reports (Spam Prevention)
const blotterLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    max: 2, 
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipIfAdmin,
    // FIX 3: Removed keyGenerator
    message: { message: "Security Alert: This device has reached the daily limit of 2 Blotter Reports." }
});

// Specific Limiter for Document Requests
const documentLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    max: 2, 
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipIfAdmin, 
    // FIX 4: Removed keyGenerator
    message: { message: "Security Alert: This device has reached the daily limit of 2 Document Requests." }
});

// ============================================================================
// 6. DATA MODELS (SCHEMAS)
// ============================================================================

// --- User Schema ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, index: true },
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

const User = mongoose.model("User", userSchema);

// --- Verification Schema ---
const verificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true },
    contactNumber: String,
    barangayZone: String,
    houseStreetAddress: String,
    validIdType: String,
    idNumber: String,
    idPhotoPath: String, 
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending', index: true },
    submittedAt: { type: Date, default: Date.now }
});
const Verification = mongoose.model("Verification", verificationSchema);

// --- Audit Log Schema (Blockchain) ---
const logSchema = new mongoose.Schema({
  timestamp: { type: String, required: true }, 
  user: String,
  action: String,
  module: String,
  description: String,
  hash: { type: String, unique: true, required: true }, // The digital signature
  previousHash: { type: String, required: true },       // Link to previous block
}, { timestamps: true });

// Optimize: Index on hash for verification speed
logSchema.index({ hash: 1 });
logSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", logSchema);

// --- Official Schema ---
const officialSchema = new mongoose.Schema({
  name: String,
  position: String,
  committee: String,
  contact: String,
  email: String,
  termStart: String,
  termEnd: String,
  status: { type: String, default: "Active", index: true }, 
}, { timestamps: true });
const Official = mongoose.model("Official", officialSchema);

// --- Resident Schema ---
const residentSchema = new mongoose.Schema({
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    name: String, 
    // OPTIMIZATION: Mongoose Validation for Non-Negative Age
    age: { 
        type: Number, 
        min: [0, 'Age cannot be negative'],
        required: [true, 'Age is required']
    },
    zone: String,
    status: { type: String, default: "Active", index: true },
    contact: String,
    email: String,
    address: String,
    civilStatus: String,
    gender: String,
    occupation: String,
    alias: String,
    is4Ps: { type: Boolean, default: false },
    isFarmer: { type: Boolean, default: false }
}, { timestamps: true });

// Optimize: Text index for search functionality
residentSchema.index({ firstName: 'text', lastName: 'text', alias: 'text' });
const Resident = mongoose.model("Resident", residentSchema);

// --- Certificate Schema ---
const certificateSchema = new mongoose.Schema({
  residentName: { type: String, index: true },
  // OPTIMIZATION: Validation
  age: { type: Number, min: [0, 'Age cannot be negative'] },
  certificateType: String,
  purpose: String,
  referenceNo: String,
  dateRequested: String,
  source: { type: String, default: "Walk-in" },
  status: { type: String, default: "Pending", index: true },
  filePath: String,
}, { timestamps: true });
const Certificate = mongoose.model("Certificate", certificateSchema);

// --- Blotter Case Schema ---
const blotterCaseSchema = new mongoose.Schema({
  complainant: { type: String, required: true },
  contactNumber: { type: String }, 
  respondent: { type: String, required: true },
  type: { type: String, default: "Incident" },
  location: String,
  date: String,
  narrative: String,
  status: { type: String, default: "Active", index: true }, 
  source: { type: String, default: "Walk-In" } 
}, { timestamps: true });
const BlotterCase = mongoose.model("BlotterCase", blotterCaseSchema);

// --- Announcement Schema ---
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active', index: true },
    primaryTag: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    secondaryTag: { type: String, enum: ['Warning', 'Success', 'Info'], default: 'Info' },
    location: { type: String }, 
    eventTime: { type: String }, 
    organizer: { type: String }, 
    views: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    createdBy: { type: String, default: 'System' },
}, { timestamps: true }); 

const Announcement = mongoose.model("Announcement", announcementSchema);

// ============================================================================
// 7. HELPERS: AUDIT, AUTH, & UTILS
// ============================================================================

/**
 * Creates an immutable audit log entry linked to the previous entry.
 * Implements a basic Blockchain structure (Linked List + Hashing).
 */
const logAction = async (action, module, description, user = "System") => {
  try {
    // 1. Get the Tip of the Chain
    const latestLog = await AuditLog.findOne().sort({ timestamp: -1 });
    const prevHash = latestLog ? latestLog.hash : "00000000000000000000000000000000";

    // 2. Lock Timestamp as ISO String (CRITICAL FOR VERIFICATION)
    const timestamp = new Date().toISOString();

    // 3. Create Canonical Object (Block Data)
    // The order must be EXACT: timestamp, user, action, module, description, previousHash
    const dataToHash = {
      timestamp: timestamp,
      user: user,
      action: action,
      module: module,
      description: description,
      previousHash: prevHash
    };

    // 4. Mine the Block (SHA-256)
    const hash = crypto.createHash("sha256").update(JSON.stringify(dataToHash)).digest("hex");

    // 5. Save to Ledger
    await AuditLog.create({
      timestamp: timestamp, 
      user,
      action,
      module,
      description,
      hash,
      previousHash: prevHash
    });

    console.log(`🔗 [BLOCKCHAIN] Block Mined: ${hash.substring(0, 10)}... | Action: ${action}`);

  } catch (err) {
    console.error("❌ Blockchain Error:", err.message);
  }
};

/**
 * Middleware: Verify JWT Token
 */
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) { 
    return res.status(401).json({ message: "Invalid or expired token", error: error.message }); 
  }
};

// Role-Based Access Control Middlewares
const adminOnly = (req, res, next) => { 
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" }); 
    next(); 
};
const adminOrStaff = (req, res, next) => { 
    if (!["admin", "staff"].includes(req.user.role)) return res.status(403).json({ message: "Admin or Staff required" }); 
    next(); 
};

// ============================================================================
// 8. ROUTES: AUTHENTICATION
// ============================================================================

// 1. SIGNUP (Optimized with Security Key Check)
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, name, position, email, contactNumber, role, signupKey } = req.body; 

    // Basic Validation
    if (!username || !password || !name || !email) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    
    // Check Duplicates
    if (await User.findOne({ username })) return res.status(400).json({ message: "Username taken" });
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already registered" });

    // --- OPTIMIZED ROLE ASSIGNMENT ---
    // User requests a role (e.g., 'admin').
    // We check if the provided 'signupKey' is the correct key for that role.
    let finalRole = 'resident';
    
    if (role && role !== 'resident') {
        // If they want to be admin/staff, they MUST provide the correct key
        if (signupKey && SIGNUP_KEYS[signupKey] === role) {
            finalRole = role;
        } else {
            // Invalid key provided for the requested role
            return res.status(403).json({ message: `Invalid security key for role: ${role}` });
        }
    }

    const finalPosition = position || (finalRole === "admin" ? "System Admin" : "Resident");

    // Hash Password
    const hashed = await bcrypt.hash(password, 10);
    
    // Create User
    await User.create({ 
        username, 
        password: hashed, 
        role: finalRole, 
        name, 
        position: finalPosition, 
        email, 
        contactNumber, 
        isActive: true 
    }); 

    await logAction("SIGNUP", "Auth", `New Account (${finalRole}): ${username}`, "System");

    // Welcome Email
    if (email) {
        await sendEmail(email, "Welcome to Barangay Tugui Grande", `
            <h3>Welcome ${name}!</h3>
            <p>Your account has been created successfully.</p>
            <p><strong>Role:</strong> ${finalRole.toUpperCase()}</p>
        `);
    }
    res.json({ message: "Account created successfully" });
  } catch (err) { res.status(500).json({ message: "Server error", error: err.message }); }
});

// 2. GENERAL LOGIN (Admin/Staff)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });
    if (user.isActive === false) return res.status(403).json({ message: "Login denied. Your account is currently inactive/banned." });
    
    let redirectPath = "/dashboard"; 
    if (user.role === "resident") redirectPath = "/resident-dashboard"; 
    
    const token = jwt.sign({ 
        id: user._id, role: user.role, username: user.username, redirectPath: redirectPath 
    }, JWT_SECRET, { expiresIn: "24h" }); 

    await logAction("LOGIN", "Auth", `User logged in: ${username}`, username);

    res.json({ 
        token, 
        user: { id: user._id, username, role: user.role, name: user.name, redirectPath: redirectPath } 
    });
  } catch (err) { res.status(500).json({ message: "Server error", error: err.message }); }
});

// 3. RESIDENT SPECIFIC LOGIN
app.post("/api/auth/resident-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });
    if (user.role !== "resident") return res.status(403).json({ message: "Access denied. Only resident accounts may use this login." });
    if (user.isActive === false) return res.status(403).json({ message: "Login denied. Your account is currently inactive/banned." });

    const redirectPath = "/resident-dashboard"; 
    const token = jwt.sign({ 
        id: user._id, role: user.role, username: user.username, redirectPath: redirectPath
    }, JWT_SECRET, { expiresIn: "24h" }); 

    await logAction("LOGIN", "Auth", `Resident logged in: ${username}`, username);

    res.json({ 
        token, 
        user: { id: user._id, username, role: user.role, name: user.name, redirectPath: redirectPath } 
    });
  } catch (err) { res.status(500).json({ message: "Server error", error: err.message }); }
});

// ============================================================================
// 9. ROUTES: RESIDENTS
// ============================================================================

/**
 * DELETE: Clear All (Archive All)
 * Optimization: Uses bulk write for performance.
 */
app.delete("/api/residents/clear-all", authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await Resident.updateMany({ status: { $ne: 'Archived' } }, { $set: { status: 'Archived' } });
        await logAction("BULK_ARCHIVE", "Resident", `Archived ${result.modifiedCount} residents (Clear Data)`, req.user.username);
        res.json({ message: "All active residents moved to Archive", count: result.modifiedCount });
    } catch (err) { res.status(500).json({ message: "Failed to clear", error: err.message }); }
});

/**
 * POST: Bulk Import
 * Optimization: Validates inputs and sanitizes Age to prevent negative numbers.
 */
app.post("/api/residents/bulk-import", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const residentsData = req.body;
    if (!Array.isArray(residentsData)) return res.status(400).json({ message: "Invalid format. Expected array." });
    
    const cleanData = residentsData.map(res => ({
      firstName: res.firstName || res.name?.split(" ")[0] || "Unknown",
      lastName: res.lastName || res.name?.split(" ").slice(1).join(" ") || "",
      
      // OPTIMIZATION: Logic to prevent negative numbers from Excel/CSV imports
      age: Math.max(0, Number(res.age) || 0), 

      zone: res.zone || "Unassigned",
      status: res.status || "Active",
      contact: res.contact || res.phone || "",
      email: res.email || "",
      address: res.address || "",
      civilStatus: res.civilStatus || "",
      gender: res.gender || "",
      occupation: res.occupation || "",
      alias: res.alias || "",
      is4Ps: res.is4Ps || false,
      isFarmer: res.isFarmer || false
    }));

    // ordered: false ensures that if one fails (e.g. duplicate), others still continue
    const result = await Resident.insertMany(cleanData, { ordered: false });
    await logAction("IMPORT", "Resident", `Bulk imported ${result.length} residents`, req.user.username);
    res.status(201).json({ message: "Bulk import successful", count: result.length });
  } catch (err) {
    if(err.code === 11000) return res.status(200).json({ message: "Imported with duplicates skipped", count: err.result?.nInserted || 0 });
    res.status(500).json({ message: "Import failed", error: err.message });
  }
});

app.post("/api/residents", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    // OPTIMIZATION: Immediate validation
    if (req.body.age !== undefined && req.body.age < 0) {
        return res.status(400).json({ message: "Validation Error: Age cannot be negative." });
    }
    const resident = await Resident.create(req.body);
    await logAction("CREATE", "Resident", `Added resident: ${resident.firstName}`, req.user.username);
    res.status(201).json({ message: "Resident added", resident });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

/**
 * GET: Fetch Residents
 * Optimization: Implements Pagination and Filtering
 * Query Params: ?page=1&limit=50&search=John
 */
app.get("/api/residents", authMiddleware, async (req, res) => {
  try { 
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 0; // 0 = no limit (for backward compatibility if needed)
      const search = req.query.search || "";

      let query = { status: "Active" };

      // Search Logic
      if (search) {
          query.$or = [
              { firstName: { $regex: search, $options: 'i' } },
              { lastName: { $regex: search, $options: 'i' } },
              { alias: { $regex: search, $options: 'i' } }
          ];
      }

      const residentsQuery = Resident.find(query).sort({ createdAt: -1 });

      if (limit > 0) {
          residentsQuery.skip((page - 1) * limit).limit(limit);
      }

      const residents = await residentsQuery;
      
      // If pagination requested, return meta data
      if (limit > 0) {
          const total = await Resident.countDocuments(query);
          return res.json({
              data: residents,
              pagination: { total, page, limit, pages: Math.ceil(total / limit) }
          });
      }

      res.json(residents); 
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.get("/api/residents/archive", authMiddleware, adminOrStaff, async (req, res) => {
  try { 
      const residents = await Resident.find({ status: "Archived" }).sort({ updatedAt: -1 }); 
      res.json(residents); 
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.put("/api/residents/:id", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    // OPTIMIZATION: Input Validation
    if (req.body.age !== undefined && req.body.age < 0) {
        return res.status(400).json({ message: "Validation Error: Age cannot be negative." });
    }
    // runValidators: true ensures Schema limits are respected on update
    const resident = await Resident.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!resident) return res.status(404).json({ message: "Resident not found" });
    await logAction("UPDATE", "Resident", `Updated resident: ${resident.firstName}`, req.user.username);
    res.json({ message: "Updated", resident });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.delete("/api/residents/:id", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const resident = await Resident.findByIdAndUpdate(req.params.id, { status: "Archived" }, { new: true });
    if (!resident) return res.status(404).json({ message: "Resident not found" });
    await logAction("ARCHIVE", "Resident", `Moved resident to archive: ${resident.firstName}`, req.user.username);
    res.json({ message: "Resident moved to Archive" });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.delete("/api/residents/permanent/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const resident = await Resident.findByIdAndDelete(req.params.id);
        if (!resident) return res.status(404).json({ message: "Resident not found" });
        await logAction("DELETE PERMANENT", "Resident", `Permanently deleted resident: ${resident.firstName}`, req.user.username);
        res.json({ message: "Resident permanently deleted" });
    } catch (err) { res.status(500).json({ message: "Failed to delete permanently", error: err.message }); }
});

// ============================================================================
// 10. ROUTES: OFFICIALS
// ============================================================================

app.get("/api/officials", authMiddleware, async (req, res) => {
  try { const officials = await Official.find({ status: "Active" }).sort({ createdAt: -1 }); res.json(officials); } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.get("/api/officials/archive", authMiddleware, adminOrStaff, async (req, res) => {
  try { const officials = await Official.find({ status: "Archived" }).sort({ updatedAt: -1 }); res.json(officials); } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.post("/api/officials", authMiddleware, adminOnly, async (req, res) => {
  try {
    const official = await Official.create(req.body);
    await logAction("CREATE", "Official", `Added official: ${official.name}`, req.user.username);
    res.json({ message: "Official added", official });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.put("/api/officials/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const official = await Official.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!official) return res.status(404).json({ message: "Official not found" });
    await logAction("UPDATE", "Official", `Updated official: ${official.name}`, req.user.username);
    res.json({ message: "Official updated", official });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.delete("/api/officials/:id", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const official = await Official.findByIdAndUpdate(req.params.id, { status: "Archived" }, { new: true });
    if (!official) return res.status(404).json({ message: "Official not found" });
    await logAction("ARCHIVE", "Official", `Moved official to archive: ${official.name}`, req.user.username);
    res.json({ message: "Official moved to Archive" });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.delete("/api/officials/permanent/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const official = await Official.findByIdAndDelete(req.params.id);
        if (!official) return res.status(404).json({ message: "Official not found" });
        await logAction("DELETE PERMANENT", "Official", `Permanently deleted official: ${official.name}`, req.user.username);
        res.json({ message: "Official permanently deleted" });
    } catch (err) { res.status(500).json({ message: "Failed to delete permanently", error: err.message }); }
});

// ============================================================================
// 11. ROUTES: DOCUMENTS / CERTIFICATES
// ============================================================================

app.post("/api/certificates", documentLimiter, async (req, res) => {
  try {
    const { residentName, certificateType, purpose, referenceNo, dateRequested, source, status, age } = req.body;
    
    // OPTIMIZATION: Backend check for negative age
    if (age !== undefined && Number(age) < 0) {
        return res.status(400).json({ message: "Validation Error: Age cannot be negative." });
    }

    const token = req.headers.authorization?.split(" ")[1];
    let finalSource = 'Online';
    let finalStatus = 'Pending';
    let userLogger = residentName || 'Online Request'; 

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userLogger = decoded.username;
            if(decoded.role === 'admin' || decoded.role === 'staff') {
                finalSource = source || 'Walk-in';
                finalStatus = status || 'Issued';
            }
        } catch(e) {}
    }

    const cert = await Certificate.create({
      residentName, age, certificateType, purpose, referenceNo, dateRequested, source: finalSource, status: finalStatus
    });
    
    await logAction("CREATE", "Documents", `Request: ${certificateType} for ${residentName}`, userLogger);

    if (finalSource === 'Online' && process.env.ADMIN_EMAIL) {
        await sendEmail(
            process.env.ADMIN_EMAIL,
            `📄 New Document Request: ${certificateType}`,
            `<p><strong>Resident:</strong> ${residentName}</p><p><strong>Type:</strong> ${certificateType}</p><p><strong>Purpose:</strong> ${purpose}</p>`
        );
    }
    res.json({ message: "Certificate request submitted/added", cert });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.get("/api/certificates/archive", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const certs = await Certificate.find({ status: "Archived" }).sort({ updatedAt: -1 });
        const formatted = certs.map(c => ({...c.toObject(), type: 'Document'}));
        res.json(formatted);
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.get("/api/certificates", authMiddleware, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'resident') {
            const user = await User.findById(req.user.id);
            if (user) query = { residentName: user.name }; 
        }
        
        if (req.query.status === 'Archived') {
            query.status = 'Archived';
        } else if (req.query.status !== 'All') {
             query.status = { $ne: 'Archived' };
         }
         
        const certs = await Certificate.find(query).sort({ createdAt: -1 });
        res.json(certs);
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.put("/api/certificates/:id", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    if (req.body.age !== undefined && Number(req.body.age) < 0) {
        return res.status(400).json({ message: "Age cannot be negative." });
    }

    const cert = await Certificate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    const actionType = req.body.status && Object.keys(req.body).length === 1 ? "UPDATE STATUS" : "EDIT DETAILS";
    await logAction("UPDATE", "Documents", `${actionType} for ${cert.residentName}`, req.user.username);
    res.json({ message: "Update successful", cert });
  } catch (err) { res.status(500).json({ message: "Update failed", error: err.message }); }
});

app.delete("/api/certificates/:id", authMiddleware, adminOrStaff, async (req, res) => {
    const { permanent } = req.query;
    try {
        if (permanent === 'true' && req.user.role === 'admin') {
            const cert = await Certificate.findByIdAndDelete(req.params.id);
            if (!cert) return res.status(404).json({ message: "Certificate not found" });
            await logAction("DELETE PERMANENT", "Documents", `Permanently deleted certificate for ${cert.residentName}`, req.user.username);
            return res.json({ message: "Certificate permanently deleted" });
        } else {
            const cert = await Certificate.findByIdAndUpdate(req.params.id, { status: 'Archived' }, { new: true });
            if (!cert) return res.status(404).json({ message: "Certificate not found" });
            await logAction("ARCHIVE", "Documents", `Archived certificate for ${cert.residentName}`, req.user.username);
            return res.json({ message: "Certificate archived" });
        }
  } catch (err) { res.status(500).json({ message: "Delete failed", error: err.message }); }
});

// ============================================================================
// 12. ROUTES: BLOTTER CASES
// ============================================================================

app.get("/api/blotters", authMiddleware, async (req, res) => {
  try {
    const cases = await BlotterCase.find({
      status: { $in: ["Active", "Settled"] }
    }).sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cases", error: err.message });
  }
});

app.get("/api/blotters/archive", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const cases = await BlotterCase.find({ status: "Archived" }).sort({ updatedAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch archive", error: err.message });
  }
});

app.put("/api/blotters/:id", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; 

    const updatedCase = await BlotterCase.findByIdAndUpdate(
      id,
      updates,
      { new: true } 
    );

    if (!updatedCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (req.user && req.user.username) {
      let actionType = "UPDATE";
      let logMessage = `Updated case details: ${updatedCase.complainant}`;

      if (updates.status === 'Archived') {
        actionType = "ARCHIVE";
        logMessage = `Moved case to Archive: ${updatedCase.complainant}`;
      } else if (updates.status === 'Settled') {
        actionType = "SETTLE";
        logMessage = `Marked case as Settled: ${updatedCase.complainant}`;
      }

      await logAction(actionType, "Blotter", logMessage, req.user.username);
    }

    res.json({ message: "Case updated successfully", blot: updatedCase });

  } catch (err) {
    res.status(500).json({ message: "Failed to update case", error: err.message });
  }
});

app.post("/api/blotters", blotterLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    let finalSource = 'Online';
    let finalStatus = 'Active';
    let userLogger = req.body.complainant || 'Online Request';

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userLogger = decoded.username;
        if (decoded.role === 'admin' || decoded.role === 'staff') {
          finalSource = req.body.source || 'Walk-In';
          finalStatus = req.body.status || 'Active';
        }
      } catch (e) { }
    }

    const newCase = await BlotterCase.create({ ...req.body, source: finalSource, status: finalStatus });
    
    await logAction("CREATE", "Blotter", `Filed case: ${newCase.complainant} vs ${newCase.respondent}`, userLogger);

    if (finalSource === 'Online' && process.env.ADMIN_EMAIL) {
      await sendEmail(
        process.env.ADMIN_EMAIL,
        `⚠️ New Blotter Report Filed`,
        `<p><strong>Complainant:</strong> ${newCase.complainant}</p><p><strong>Respondent:</strong> ${newCase.respondent}</p>`
      );
    }
    
    res.status(201).json({ message: "Blotter report submitted successfully", blot: newCase });
  } catch (err) {
    res.status(500).json({ message: "Failed to create case", error: err.message });
  }
});

// ============================================================================
// 13. ROUTES: ANNOUNCEMENTS
// ============================================================================

app.post("/api/announcements", authMiddleware, adminOrStaff, (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
        } else if (err) {
            return res.status(500).json({ message: "Upload error." });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { title, description, primaryTag, secondaryTag, expiresAt, status, location, eventTime, organizer } = req.body;
        if (!title || !description || !expiresAt) return res.status(400).json({ message: "Missing fields." });

        const imageUrl = req.file ? req.file.path : "";

        const announcement = await Announcement.create({
            title, description, imageUrl, primaryTag: primaryTag || 'LOW', secondaryTag: secondaryTag || 'Info',
            location: location || "Barangay Hall", eventTime: eventTime || "N/A", organizer: organizer || "Barangay Council",
            expiresAt: new Date(expiresAt), createdBy: req.user.username, status: status === 'Ended' ? 'Archived' : 'Active',
        });

        await logAction("CREATE", "Announcement", `Posted: ${title}`, req.user.username);
        res.status(201).json({ message: "Announcement posted", announcement });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

app.get("/api/announcements", async (req, res) => {
    try {
        const announcements = await Announcement.find({ status: 'Active', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) { res.status(500).json({ message: "Error fetching" }); }
});

app.get("/api/announcements/archive", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const announcements = await Announcement.find({ $or: [ { status: 'Archived' }, { expiresAt: { $lte: new Date() } } ] }).sort({ expiresAt: -1 });
        res.json(announcements);
    } catch (err) { res.status(500).json({ message: "Error fetching" }); }
});

app.put("/api/announcements/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!announcement) return res.status(404).json({ message: "Not found" });
        await logAction("EDIT", "Announcement", `Updated: ${announcement.title}`, req.user.username);
        res.json({ message: "Updated", announcement });
    } catch (err) { res.status(500).json({ message: "Error updating" }); }
});

app.delete("/api/announcements/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const announcement = await Announcement.findByIdAndUpdate(req.params.id, { status: 'Archived' });
        if (!announcement) return res.status(404).json({ message: "Announcement not found" });
        await logAction("ARCHIVE", "Announcement", `Archived: ${announcement.title}`, req.user.username);
        res.json({ message: "Announcement moved to Archive" });
    } catch (err) { res.status(500).json({ message: "Error archiving" }); }
});

app.delete("/api/announcements/permanent/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const announcement = await Announcement.findByIdAndDelete(req.params.id);
        if (!announcement) return res.status(404).json({ message: "Announcement not found" });
        await logAction("DELETE PERMANENT", "Announcement", `Permanently deleted: ${announcement.title}`, req.user.username);
        res.json({ message: "Announcement permanently deleted" });
    } catch (err) { res.status(500).json({ message: "Error deleting permanently" }); }
});

// ============================================================================
// 14. ROUTES: AUDIT LOGS (With Integrity Verification)
// ============================================================================

app.get("/api/audit-logs", authMiddleware, adminOnly, async (req, res) => {
  try { 
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 200; // Limit default to 200

      const logs = await AuditLog.find()
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      res.json(logs); 
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

/**
 * OPTIMIZATION: Blockchain Integrity Check
 * Iterates through the audit log to verify cryptographic links.
 */
app.get("/api/audit-logs/verify", authMiddleware, adminOnly, async (req, res) => {
    try {
        // Fetch logs in ascending order (Oldest -> Newest)
        const logs = await AuditLog.find().sort({ timestamp: 1 });
        let isValid = true;
        let compromisedBlock = null;

        for (let i = 0; i < logs.length; i++) {
            const currentBlock = logs[i];
            
            // Re-calculate hash
            const dataToHash = {
                timestamp: currentBlock.timestamp,
                user: currentBlock.user,
                action: currentBlock.action,
                module: currentBlock.module,
                description: currentBlock.description,
                previousHash: currentBlock.previousHash
            };
            const calculatedHash = crypto.createHash("sha256").update(JSON.stringify(dataToHash)).digest("hex");

            // 1. Check if data was tampered (Hash Mismatch)
            if (calculatedHash !== currentBlock.hash) {
                isValid = false;
                compromisedBlock = { index: i, type: "Data Tampering", id: currentBlock._id };
                break;
            }

            // 2. Check Chain Link (Previous Hash Mismatch)
            if (i > 0) {
                const previousBlock = logs[i - 1];
                if (currentBlock.previousHash !== previousBlock.hash) {
                    isValid = false;
                    compromisedBlock = { index: i, type: "Chain Break", id: currentBlock._id };
                    break;
                }
            }
        }

        if (isValid) {
            res.json({ status: "Secure", message: "Blockchain integrity verified. No tampering detected." });
        } else {
            // Log security alert to console
            console.error("🚨 SECURITY ALERT: Blockchain tampering detected at block", compromisedBlock);
            res.status(400).json({ 
                status: "Compromised", 
                message: "Integrity check failed.", 
                details: compromisedBlock 
            });
        }
    } catch (err) {
        res.status(500).json({ message: "Verification failed", error: err.message });
    }
});

// ============================================================================
// 15. UTILITY & USER ROUTES 
// ============================================================================

app.get("/api/users/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ fullName: user.name, username: user.username, email: user.email || "", contactNumber: user.contactNumber || "", photo: user.photo || "", frameEnabled: user.frameEnabled || false, role: user.role });
  } catch (err) { res.status(500).json({ message: "Server error", error: err.message }); }
});

app.post("/api/users/upload-photo", authMiddleware, (req, res, next) => {
    upload.single("photo")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: "Upload failed: " + err.message });
        } else if (err) {
            console.error("Upload Error:", err);
            return res.status(500).json({ message: "Server upload error." });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ message: "No file provided or upload failed." });
        }
        
        const photoUrl = req.file.path; 

        const user = await User.findByIdAndUpdate(
            req.user.id, 
            { photo: photoUrl }, 
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        await logAction("UPDATE_PHOTO", "User", `Updated profile photo`, req.user.username);
        
        res.json({ message: "Photo uploaded successfully", photoUrl: user.photo });

    } catch (err) {
        res.status(500).json({ message: "Failed to save photo URL", error: err.message });
    }
});

app.put("/api/users/update-info", authMiddleware, async (req, res) => {
    try {
        const { fullName, email, contactNumber } = req.body;
        
        const updateFields = {
            name: fullName,
            email: email,
            contactNumber: contactNumber,
        };

        const user = await User.findByIdAndUpdate(
            req.user.id, 
            updateFields, 
            { new: true, runValidators: true, select: "-password" }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        await logAction("UPDATE_INFO", "User", `Updated profile info`, req.user.username);
        res.json({ message: "Profile updated successfully", user });

    } catch (err) {
        res.status(500).json({ message: "Failed to update profile", error: err.message });
    }
});

app.put("/api/users/change-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Missing password fields" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!(await bcrypt.compare(oldPassword, user.password))) {
            return res.status(400).json({ message: "Invalid current password" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        await logAction("PASSWORD_CHANGE", "User", `Changed password`, req.user.username);
        res.json({ message: "Password updated successfully" });

    } catch (err) {
        res.status(500).json({ message: "Failed to change password", error: err.message });
    }
});

/**
 * OPTIMIZATION: Unified Archives Fetcher
 * Fetches all archived items from different collections and standardizes them.
 */
app.get("/api/archives/all", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const [residents, officials, documents, blotters, announcements] = await Promise.all([
            Resident.find({ status: "Archived" }).lean(),
            Official.find({ status: "Archived" }).lean(),
            Certificate.find({ status: "Archived" }).lean(),
            BlotterCase.find({ status: "Archived" }).lean(),
            Announcement.find({ $or: [{ status: 'Archived' }, { expiresAt: { $lte: new Date() } }] }).lean()
        ]);

        const allArchives = [
            ...residents.map(i => ({ ...i, type: 'Resident', displayTitle: `${i.firstName} ${i.lastName}` })),
            ...officials.map(i => ({ ...i, type: 'Official', displayTitle: i.name })),
            ...documents.map(i => ({ ...i, type: 'Document', displayTitle: `${i.certificateType} - ${i.residentName}` })),
            ...blotters.map(i => ({ ...i, type: 'Blotter', displayTitle: `Case: ${i.complainant} vs ${i.respondent}` })),
            ...announcements.map(i => ({ ...i, type: 'Announcement', displayTitle: i.title }))
        ];

        // Sort by most recent update
        allArchives.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
        });

        res.json(allArchives);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch global archives", error: err.message });
    }
});

app.get("/api/stats", authMiddleware, adminOrStaff, async (req, res) => {
  try {
    const [officialsCount, residentsCount, certificatesCount, blottersCount, auditCount, announcementsCount] = await Promise.all([
      Official.countDocuments({ status: "Active" }),
      Resident.countDocuments({ status: "Active" }),
      Certificate.countDocuments({ status: { $ne: 'Archived' } }),
      BlotterCase.countDocuments({ status: "Active" }),
      AuditLog.countDocuments(),
      Announcement.countDocuments({ status: 'Active', expiresAt: { $gt: new Date() } }) 
    ]);
    res.json({ 
        officials: officialsCount, 
        residents: residentsCount, 
        certificates: certificatesCount, 
        blotter: blottersCount, 
        audit: auditCount, 
        announcements: announcementsCount 
    });
  } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

// ============================================================================
// 16. SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log(`
    ################################################
    🚀  Server running on port: ${PORT}
    🛡️   Environment: ${process.env.NODE_ENV || 'development'}
    ⛓️   Blockchain Logging: ENABLED
    ################################################
  `);
});
