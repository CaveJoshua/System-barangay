import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { AuditLog } from "../models/Schemas.js";
import dotenv from "dotenv";

dotenv.config();

// --- 1. CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barangay-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1080, crop: "limit" }, { quality: "auto" }, { fetch_format: "auto" }]
  },
});

// --- 2. EMAIL CONFIG ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async (to, subject, htmlContent) => {
  try {
    if (!to) return; 
    const mailOptions = {
      from: `"Barangay Tugui Grande" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email failed:", error.message);
  }
};

// --- 3. AUDIT LOGGER ---
export const logAction = async (action, module, description, user = "System") => {
  try {
    const latestLog = await AuditLog.findOne().sort({ timestamp: -1 });
    const prevHash = latestLog ? latestLog.hash : "00000000000000000000000000000000";
    const logData = { timestamp: new Date(), user, action, module, description, previousHash: prevHash };
    const hash = crypto.createHash("sha256").update(JSON.stringify(logData)).digest("hex");
    await AuditLog.create({ ...logData, hash });
    console.log(`🔗 [AUDIT] ${action} in ${module} by ${user}`);
  } catch (err) {
    console.error("Failed to log audit:", err.message);
  }
};