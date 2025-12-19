import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { storage } from "../utils/services.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// --- AUTH MIDDLEWARE ---
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) { return res.status(401).json({ message: "Invalid token" }); }
};

// --- ROLE CHECKS ---
export const adminOnly = (req, res, next) => { if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" }); next(); };
export const adminOrStaff = (req, res, next) => { if (!["admin", "staff"].includes(req.user.role)) return res.status(403).json({ message: "Staff/Admin only" }); next(); };
export const residentOrHigher = (req, res, next) => { if (!["admin", "staff", "resident"].includes(req.user.role)) return res.status(403).json({ message: "Auth required" }); next(); };

// --- RATE LIMITER HELPER (Skip for Admins) ---
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

// --- LIMITERS ---
export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });

export const blotterLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    max: 2, 
    standardHeaders: true, legacyHeaders: false, skip: skipIfAdmin, 
    keyGenerator: (req) => req.body.complainant ? `blotter_${req.body.complainant.trim().toLowerCase()}` : `blotter_${req.ip}`,
    message: { message: "Security Alert: Daily limit reached." }
});

export const documentLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    max: 2, 
    standardHeaders: true, legacyHeaders: false, skip: skipIfAdmin, 
    keyGenerator: (req) => req.body.residentName ? `doc_${req.body.residentName.trim().toLowerCase()}` : `doc_${req.ip}`,
    message: { message: "Security Alert: Daily limit reached." }
});

// --- UPLOAD MIDDLEWARE (2MB Limit) ---
export const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});