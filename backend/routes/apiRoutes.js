import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { 
    User, 
    Resident, 
    Official, 
    Certificate, 
    BlotterCase, 
    Announcement, 
    Verification, 
    AuditLog 
} from "../models/Schemas.js";
import { sendEmail, logAction } from "../utils/services.js";
import { 
    authMiddleware, 
    adminOnly, 
    adminOrStaff, 
    residentOrHigher, 
    blotterLimiter, 
    documentLimiter, 
    upload 
} from "../middleware/security.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret"; 
const SIGNUP_KEYS = { ADMIN123: "admin", STAFF123: "staff", RESIDENT123: "resident" };

// ============================================================================
//  AUTHENTICATION ROUTES
// ============================================================================

// 1. SIGNUP
router.post("/auth/signup", async (req, res) => {
    try {
        const { username, password, signupKey, name, position, email, contactNumber } = req.body; 
        
        // Validate Key
        const role = SIGNUP_KEYS[signupKey];
        if (!role) {
            return res.status(400).json({ message: "Invalid signup key provided." });
        }

        // Validate Fields
        if (!username || !password || !name) {
            return res.status(400).json({ message: "Missing required fields (username, password, name)." });
        }
        
        // Staff/Admin Validation
        if (role !== "resident" && !position) {
            return res.status(400).json({ message: "Staff and Admin accounts require a Position title." });
        }

        // Check Duplicate
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Username is already taken." });
        }
        
        // Create User
        const finalPosition = position || (role === "resident" ? "Resident" : undefined);
        const hashed = await bcrypt.hash(password, 10);
        
        await User.create({ 
            username, 
            password: hashed, 
            role, 
            name, 
            position: finalPosition, 
            email, 
            contactNumber, 
            isActive: true 
        }); 

        // Log & Email
        await logAction("SIGNUP", "Auth", `New ${role} registered: ${username}`, "System");
        
        if (email) {
            await sendEmail(
                email, 
                "Welcome to Barangay Tugui Grande System", 
                `<h3>Welcome, ${name}!</h3><p>Your account has been successfully created. You can now log in to the resident portal.</p>`
            );
        }

        res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ message: "Server error during signup", error: err.message }); 
    }
});

// 2. LOGIN (Admin/Staff)
router.post("/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (user.isActive === false) {
            return res.status(403).json({ message: "Login denied. Your account is currently inactive/banned." });
        }

        // Determine Redirect
        let redirectPath = "/dashboard"; 
        if (user.role === "resident") {
            redirectPath = "/resident-dashboard"; 
        }

        // Generate Token
        const token = jwt.sign(
            { id: user._id, role: user.role, username: user.username, redirectPath }, 
            JWT_SECRET, 
            { expiresIn: "24h" }
        ); 

        await logAction("LOGIN", "Auth", `User logged in: ${username}`, username);
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username, 
                role: user.role, 
                name: user.name, 
                redirectPath 
            } 
        });
    } catch (err) { 
        res.status(500).json({ message: "Server error during login", error: err.message }); 
    }
});

// 3. RESIDENT LOGIN (Specific Endpoint)
router.post("/auth/resident-login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        
        if (user.role !== "resident") {
            return res.status(403).json({ message: "Access denied. Only resident accounts may use this login." });
        }

        if (user.isActive === false) {
            return res.status(403).json({ message: "Login denied. Your account is currently inactive/banned." });
        }

        const redirectPath = "/resident-dashboard"; 
        const token = jwt.sign(
            { id: user._id, role: user.role, username: user.username, redirectPath }, 
            JWT_SECRET, 
            { expiresIn: "24h" }
        ); 

        await logAction("LOGIN", "Auth", `Resident logged in: ${username}`, username);
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username, 
                role: user.role, 
                name: user.name, 
                redirectPath 
            } 
        });
    } catch (err) { 
        res.status(500).json({ message: "Server error during resident login", error: err.message }); 
    }
});

// ============================================================================
//  ANNOUNCEMENT ROUTES (With Cloudinary Upload)
// ============================================================================

// POST: Create Announcement
router.post("/announcements", authMiddleware, adminOrStaff, (req, res, next) => {
    // Handle Multer errors specifically for File Size
    upload.single("image")(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File too large. Maximum size is 2MB." });
        } else if (err) {
            return res.status(500).json({ message: "Image upload failed." });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { title, description, primaryTag, secondaryTag, expiresAt, status, location, eventTime, organizer } = req.body;
        
        if (!title || !description || !expiresAt) {
            return res.status(400).json({ message: "Title, description, and expiration date are required." });
        }

        // Get Cloudinary URL
        const imageUrl = req.file ? req.file.path : "";
        const finalStatus = status === 'Ended' ? 'Archived' : 'Active';

        const announcement = await Announcement.create({
            title,
            description,
            imageUrl: imageUrl, 
            primaryTag: primaryTag || 'LOW',
            secondaryTag: secondaryTag || 'Info',
            location: location || "Barangay Hall Main Grounds",
            eventTime: eventTime || "N/A",
            organizer: organizer || "Barangay Council",
            expiresAt: new Date(expiresAt),
            createdBy: req.user.username,
            status: finalStatus,
        });

        await logAction("CREATE", "Announcement", `Posted new announcement: ${title}`, req.user.username);
        res.status(201).json({ message: "Announcement posted successfully", announcement });
    } catch (err) {
        res.status(500).json({ message: "Failed to post announcement", error: err.message });
    }
});

// GET: Public Announcements
router.get("/announcements", async (req, res) => {
    try {
        const announcements = await Announcement.find({ 
            status: 'Active', 
            expiresAt: { $gt: new Date() } 
        }).sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch announcements", error: err.message });
    }
});

// GET: Archive
router.get("/announcements/archive", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const announcements = await Announcement.find({ 
            $or: [
                { status: 'Archived' },
                { expiresAt: { $lte: new Date() } }
            ]
        }).sort({ expiresAt: -1 });
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch archived announcements", error: err.message });
    }
});

// PUT: Update Announcement
router.put("/announcements/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const { id } = req.params;
        let updates = { ...req.body };

        if (typeof updates.isActive === 'boolean') {
            updates.status = updates.isActive ? 'Active' : 'Archived';
            delete updates.isActive; 
        }

        const announcement = await Announcement.findByIdAndUpdate(id, updates, { new: true });
        
        if (!announcement) return res.status(404).json({ message: "Announcement not found" });
        
        const actionType = Object.keys(updates).length === 1 && updates.views !== undefined ? "VIEWED" : "EDITED";
        
        if (actionType !== "VIEWED") {
            await logAction(actionType, "Announcement", `${actionType} announcement: ${announcement.title}`, req.user.username);
        }
        
        res.json({ message: "Announcement updated", announcement });
    } catch (err) {
        res.status(500).json({ message: "Failed to update announcement", error: err.message });
    }
});

// DELETE: Archive or Delete Announcement
router.delete("/announcements/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query; 

        if (hardDelete === 'true') {
            const announcement = await Announcement.findByIdAndDelete(id);
            if (!announcement) return res.status(404).json({ message: "Announcement not found" });
            await logAction("DELETE PERMANENT", "Announcement", `Permanently deleted: ${announcement.title}`, req.user.username);
            res.json({ message: "Announcement permanently deleted" });
        } else {
            const announcement = await Announcement.findByIdAndUpdate(id, { status: 'Archived' });
            if (!announcement) return res.status(404).json({ message: "Announcement not found" });
            await logAction("ARCHIVE", "Announcement", `Archived: ${announcement.title}`, req.user.username);
            res.json({ message: "Announcement moved to Archive" });
        }
    } catch (err) {
        res.status(500).json({ message: "Failed to manage announcement deletion", error: err.message });
    }
});

// ============================================================================
//  RESIDENT ROUTES
// ============================================================================

// GET All Active Residents
router.get("/residents", authMiddleware, async (req, res) => {
    try {
        const residents = await Resident.find({ status: { $ne: "Archived" } }).sort({ createdAt: -1 });
        res.json(residents);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch residents", error: err.message });
    }
});

// POST Create Resident
router.post("/residents", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const resident = await Resident.create(req.body);
        await logAction("CREATE", "Resident", `Added resident: ${resident.firstName}`, req.user.username);
        res.status(201).json({ message: "Resident added", resident });
    } catch (err) {
        res.status(500).json({ message: "Failed to add resident", error: err.message });
    }
});

// DELETE Clear All (Bulk Archive)
router.delete("/residents/clear-all", authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await Resident.updateMany({ status: { $ne: 'Archived' } }, { $set: { status: 'Archived' } });
        await logAction("BULK_ARCHIVE", "Resident", `Archived ${result.modifiedCount} residents (Clear Data)`, req.user.username);
        res.json({ message: "All active residents moved to Archive", count: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ message: "Failed to clear residents", error: err.message });
    }
});

// POST Bulk Import
router.post("/residents/bulk-import", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const residentsData = req.body;
        if (!Array.isArray(residentsData)) return res.status(400).json({ message: "Invalid format." });

        const cleanData = residentsData.map(res => ({
            firstName: res.firstName || res.name?.split(" ")[0] || "Unknown",
            lastName: res.lastName || res.name?.split(" ").slice(1).join(" ") || "",
            age: Number(res.age) || 0,
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

        const result = await Resident.insertMany(cleanData, { ordered: false });
        await logAction("IMPORT", "Resident", `Bulk imported ${result.length} residents`, req.user.username);
        res.status(201).json({ message: "Bulk import successful", count: result.length });
    } catch (err) {
        if(err.code === 11000) return res.status(200).json({ message: "Imported with duplicates skipped", count: err.result?.nInserted || 0 });
        res.status(500).json({ message: "Import failed", error: err.message });
    }
});

// PUT Update Resident
router.put("/residents/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const resident = await Resident.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!resident) return res.status(404).json({ message: "Resident not found" });
        await logAction("UPDATE", "Resident", `Updated resident: ${resident.firstName}`, req.user.username);
        res.json({ message: "Updated", resident });
    } catch (err) {
        res.status(500).json({ message: "Failed to update resident", error: err.message });
    }
});

// DELETE Resident (Archive)
router.delete("/residents/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const resident = await Resident.findByIdAndUpdate(req.params.id, { status: "Archived" }, { new: true });
        if (!resident) return res.status(404).json({ message: "Resident not found" });
        await logAction("ARCHIVE", "Resident", `Moved resident to bin: ${resident.firstName}`, req.user.username);
        res.json({ message: "Resident moved to Recycle Bin" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete resident", error: err.message });
    }
});

// ============================================================================
//  OFFICIAL ROUTES
// ============================================================================
router.get("/officials", authMiddleware, async (req, res) => {
    try {
        const officials = await Official.find({ status: { $ne: "Archived" } }).sort({ createdAt: -1 });
        res.json(officials);
    } catch (err) { res.status(500).json({ message: "Failed to fetch officials", error: err.message }); }
});

router.post("/officials", authMiddleware, adminOnly, async (req, res) => {
    try {
        const official = await Official.create(req.body);
        await logAction("CREATE", "Official", `Added official: ${official.name}`, req.user.username);
        res.json({ message: "Official added", official });
    } catch (err) { res.status(500).json({ message: "Failed to add official", error: err.message }); }
});

router.put("/officials/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const official = await Official.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!official) return res.status(404).json({ message: "Official not found" });
        await logAction("UPDATE", "Official", `Updated official: ${official.name}`, req.user.username);
        res.json({ message: "Official updated", official });
    } catch (err) { res.status(500).json({ message: "Failed to update official", error: err.message }); }
});

router.delete("/officials/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const official = await Official.findByIdAndUpdate(req.params.id, { status: "Archived" }, { new: true });
        if (!official) return res.status(404).json({ message: "Official not found" });
        await logAction("ARCHIVE", "Official", `Moved official to bin: ${official.name}`, req.user.username);
        res.json({ message: "Official moved to Recycle Bin" });
    } catch (err) { res.status(500).json({ message: "Failed to delete official", error: err.message }); }
});

// ============================================================================
//  CERTIFICATE / DOCUMENT ROUTES (With Public Access + Limit)
// ============================================================================

// POST: Create Certificate Request (Public, Rate Limited)
router.post("/certificates", documentLimiter, async (req, res) => {
    try {
        const { residentName, certificateType, purpose, referenceNo, dateRequested, source, status, age } = req.body;
        
        // Determine Logic: If authenticated, use username. If guest, use "Guest" or provided Name.
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
            } catch(e) {} // Token invalid, continue as guest
        }

        const cert = await Certificate.create({
            residentName, age, certificateType, purpose, referenceNo, dateRequested, source: finalSource, status: finalStatus
        });
        
        await logAction("CREATE", "Documents", `Request: ${certificateType} for ${residentName}`, userLogger);

        // EMAIL ALERT TO ADMIN
        if (finalSource === 'Online' && process.env.ADMIN_EMAIL) {
            await sendEmail(
                process.env.ADMIN_EMAIL,
                `📄 New Document Request: ${certificateType}`,
                `<p><strong>Resident:</strong> ${residentName}</p>
                 <p><strong>Type:</strong> ${certificateType}</p>
                 <p><strong>Purpose:</strong> ${purpose}</p>
                 <p>Please check the admin dashboard to review.</p>`
            );
        }

        res.json({ message: "Certificate request submitted/added", cert });
    } catch (err) { res.status(500).json({ message: "Failed to submit request", error: err.message }); }
});

// GET: All Certificates
router.get("/certificates", authMiddleware, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'resident') {
            const user = await User.findById(req.user.id);
            if (user) query = { residentName: user.name }; 
        }
        const certs = await Certificate.find(query).sort({ createdAt: -1 });
        res.json(certs);
    } catch (err) { res.status(500).json({ message: "Failed to fetch certificates", error: err.message }); }
});

// PUT: Update Certificate
router.put("/certificates/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const cert = await Certificate.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!cert) return res.status(404).json({ message: "Certificate not found" });
        const actionType = req.body.status && Object.keys(req.body).length === 1 ? "UPDATE STATUS" : "EDIT DETAILS";
        await logAction("UPDATE", "Documents", `${actionType} for ${cert.residentName}`, req.user.username);
        res.json({ message: "Update successful", cert });
    } catch (err) { res.status(500).json({ message: "Update failed", error: err.message }); }
});

// DELETE: Archive Certificate
router.delete("/certificates/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const cert = await Certificate.findByIdAndUpdate(req.params.id, { status: 'Archived' });
        if (!cert) return res.status(404).json({ message: "Certificate not found" });
        await logAction("DELETE", "Documents", `Deleted/Archived certificate for ${cert.residentName}`, req.user.username);
        res.json({ message: "Certificate deleted/archived" });
    } catch (err) { res.status(500).json({ message: "Delete failed", error: err.message }); }
});

// ============================================================================
//  BLOTTER ROUTES (With Public Access + Limit)
// ============================================================================

// POST: Create Blotter (Public, Rate Limited)
router.post("/blotters", blotterLimiter, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        let finalSource = 'Online';
        let finalStatus = 'Active';
        let userLogger = req.body.complainant || 'Online Request';

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userLogger = decoded.username;
                if(decoded.role === 'admin' || decoded.role === 'staff') {
                    finalSource = req.body.source || 'Walk-In';
                    finalStatus = req.body.status || 'Active';
                }
            } catch (e) {}
        }

        const newCase = await BlotterCase.create({ ...req.body, source: finalSource, status: finalStatus });
        const logMsg = `Filed Online case: ${newCase.complainant} vs ${newCase.respondent}`;
        await logAction("CREATE", "Blotter", logMsg, userLogger);
        
        // EMAIL ALERT
        if (finalSource === 'Online' && process.env.ADMIN_EMAIL) {
            await sendEmail(
                process.env.ADMIN_EMAIL,
                `⚠️ New Blotter Report Filed`,
                `<p><strong>Complainant:</strong> ${newCase.complainant}</p>
                 <p><strong>Respondent:</strong> ${newCase.respondent}</p>
                 <p><strong>Type:</strong> ${newCase.type}</p>
                 <p><strong>Narrative:</strong> ${newCase.narrative}</p>
                 <p>Please review immediately.</p>`
            );
        }

        res.status(201).json({ message: "Blotter report submitted successfully", blot: newCase });
    } catch (err) { 
        console.error("Blotter Create Error:", err);
        res.status(500).json({ message: "Failed to create case", error: err.message }); 
    }
});

// GET: Blotters
router.get("/blotters", authMiddleware, async (req, res) => {
    try { const cases = await BlotterCase.find({ status: { $ne: "Archived" } }).sort({ createdAt: -1 }); res.json(cases); } catch (err) { res.status(500).json({ message: "Failed to fetch cases", error: err.message }); }
});

// PUT: Update Blotter
router.put("/blotters/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const updatedCase = await BlotterCase.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCase) return res.status(404).json({ message: "Case not found" });
        const actionType = Object.keys(req.body).length === 1 && req.body.status ? `Updated status to ${req.body.status}` : "Edited details";
        await logAction("UPDATE", "Blotter", `${actionType}: ${updatedCase.complainant} vs ${updatedCase.respondent}`, req.user.username);
        res.json({ message: "Case updated", blot: updatedCase });
    } catch (err) { res.status(500).json({ message: "Failed to update case", error: err.message }); }
});

// DELETE: Archive Blotter
router.delete("/blotters/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const blot = await BlotterCase.findByIdAndUpdate(req.params.id, { status: "Archived" }, { new: true });
        if (!blot) return res.status(404).json({ message: "Case not found" });
        await logAction("ARCHIVE", "Blotter", `Moved case to bin: ${blot.complainant} vs ${blot.respondent}`, req.user.username);
        res.json({ message: "Case moved to Recycle Bin" });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

// ============================================================================
//  UTILITY ROUTES (Stats, Logs, Verification, Users, Recycle)
// ============================================================================

// Audit Logs
router.get("/audit-logs", authMiddleware, adminOnly, async (req, res) => {
    try { const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(200); res.json(logs); } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

// Stats
router.get("/stats", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const [officialsCount, residentsCount, certificatesCount, blottersCount, auditCount, announcementsCount] = await Promise.all([
            Official.countDocuments({ status: { $ne: "Archived" } }),
            Resident.countDocuments({ status: { $ne: "Archived" } }),
            Certificate.countDocuments({ status: { $ne: "Archived" } }), // Count active only usually, but you wanted total in some contexts
            BlotterCase.countDocuments({ status: { $ne: "Archived" } }),
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

// User Profile (Me)
router.get("/users/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ fullName: user.name, username: user.username, email: user.email || "", contactNumber: user.contactNumber || "", photo: user.photo || "", frameEnabled: user.frameEnabled || false, role: user.role });
    } catch (err) { res.status(500).json({ message: "Server error", error: err.message }); }
});

// User Profile (Update)
router.put("/users/update-info", authMiddleware, async (req, res) => {
    try {
        const { fullName, username, email, contactNumber, photo, frameEnabled } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (fullName) user.name = fullName; if (username) user.username = username; if (email) user.email = email;
        if (contactNumber) user.contactNumber = contactNumber; if (photo !== undefined) user.photo = photo; if (typeof frameEnabled === "boolean") user.frameEnabled = frameEnabled;
        await user.save();
        await logAction("UPDATE", "User", `Updated profile info`, user.username);
        res.json({ message: "Profile updated successfully" });
    } catch (err) { res.status(500).json({ message: "Failed to update profile", error: err.message }); }
});

// User (Change Password)
router.put("/users/change-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        await logAction("UPDATE", "User", `Changed password`, user.username);
        res.json({ message: "Password changed successfully" });
    } catch (err) { res.status(500).json({ message: "Failed to change password", error: err.message }); }
});

// User Management Routes (Admin)
router.get("/users", authMiddleware, adminOrStaff, async (req, res) => {
    try { const users = await User.find().sort({ name: 1 }).select('-password'); res.json(users.filter(u => u.role !== 'system')); } catch (err) { res.status(500).json({ message: "Failed to fetch users", error: err.message }); }
});
router.post("/users", authMiddleware, adminOnly, async (req, res) => {
    try {
        const { username, password, name, role, position, email, contactNumber } = req.body;
        if (!username || !password || !name || !role) return res.status(400).json({ message: "Missing fields." });
        if (await User.findOne({ username })) return res.status(409).json({ message: "Username exists." });
        const newUser = await User.create({ username, password: await bcrypt.hash(password, 10), role, name, position, email, contactNumber, isActive: true });
        await logAction("CREATE", "UserManagement", `Created new ${role} account: ${username}`, req.user.username);
        res.status(201).json({ message: "User created", user: newUser });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});
router.patch("/users/status/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        if (req.user.id === req.params.id) return res.status(403).json({ message: "Cannot change own status." });
        const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
        await logAction(user.isActive ? "ACTIVATE" : "BAN", "UserManagement", `${user.username} status: ${user.isActive}`, req.user.username);
        res.json({ message: "Status updated", user });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});
router.put("/users/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        await logAction("EDIT", "UserManagement", `Edited: ${user.username}`, req.user.username);
        res.json({ message: "Updated", user });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});
router.delete("/users/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        await logAction("DELETE PERMANENT", "UserManagement", `Deleted: ${user.username}`, req.user.username);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

// Recycle Bin
router.get("/recycle-bin", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const [residents, officials, blotters, certificates, announcements] = await Promise.all([
            Resident.find({ status: "Archived" }),
            Official.find({ status: "Archived" }),
            BlotterCase.find({ status: "Archived" }),
            Certificate.find({ status: "Archived" }),
            Announcement.find({ $or: [{ status: 'Archived' }, { expiresAt: { $lte: new Date() } }] })
        ]);
        
        const allDeleted = [
            ...residents.map(r => ({ _id: r._id, type: "Resident", name: `${r.firstName} ${r.lastName}`, details: `Zone: ${r.zone}`, deletedDate: r.updatedAt })),
            ...officials.map(o => ({ _id: o._id, type: "Official", name: o.name, details: o.position, deletedDate: o.updatedAt })),
            ...blotters.map(b => ({ _id: b._id, type: "Blotter", name: `${b.complainant} vs ${b.respondent}`, details: b.type || "Case", deletedDate: b.updatedAt })),
            ...certificates.map(c => ({ _id: c._id, type: "Document", name: c.residentName, details: c.certificateType, deletedDate: c.updatedAt })),
            ...announcements.map(a => ({ _id: a._id, type: "Announcement", name: a.title, details: "Expired/Archived", deletedDate: a.updatedAt }))
        ].sort((a, b) => new Date(b.deletedDate) - new Date(a.deletedDate));
    
        res.json(allDeleted);
    } catch (err) { res.status(500).json({ message: "Failed to fetch bin", error: err.message }); }
});

router.put("/recycle-bin/restore/:id", authMiddleware, adminOrStaff, async (req, res) => {
    try {
        const { type } = req.body; const { id } = req.params; let Model;
        if (type === "Resident") Model = Resident; else if (type === "Official") Model = Official; else if (type === "Blotter") Model = BlotterCase;
        else if (type === "Announcement") Model = Announcement; else if (type === "Document") Model = Certificate; else return res.status(400).json({ message: "Invalid type" });
        
        const restoreStatus = type === "Document" ? "Issued" : "Active"; // Documents restore to Issued, others to Active
        await Model.findByIdAndUpdate(id, { status: restoreStatus });
        
        await logAction("RESTORE", "RecycleBin", `Restored ${type}`, req.user.username);
        res.json({ message: "Restored successfully" });
    } catch (err) { res.status(500).json({ message: "Restore failed", error: err.message }); }
});

router.delete("/recycle-bin/delete/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const type = req.query.type || req.body.type; const { id } = req.params; let Model;
        if (type === "Resident") Model = Resident; else if (type === "Official") Model = Official; else if (type === "Blotter") Model = BlotterCase;
        else if (type === "Announcement") Model = Announcement; else if (type === "Document") Model = Certificate; else return res.status(400).json({ message: "Invalid type" });
        
        await Model.findByIdAndDelete(id);
        await logAction("DELETE PERMANENT", "RecycleBin", `Permanently deleted ${type}`, req.user.username);
        res.json({ message: "Deleted permanently" });
    } catch (err) { res.status(500).json({ message: "Delete failed", error: err.message }); }
});

// Identity Verification
router.post("/verification/submit", authMiddleware, residentOrHigher, async (req, res) => {
    try {
        const { fullName, contactNumber, barangayZone, houseStreetAddress, validIdType, idNumber } = req.body;
        if (!fullName || !validIdType || !idNumber) return res.status(400).json({ message: "Missing fields." });
        const existing = await Verification.findOne({ userId: req.user.id, status: 'Pending' });
        if (existing) return res.status(400).json({ message: "Already pending." });
        const reqVer = await Verification.create({ userId: req.user.id, fullName, contactNumber, barangayZone, houseStreetAddress, validIdType, idNumber, idPhotoPath: `/uploads/ids/${req.user.id}_${Date.now()}.jpg`, status: 'Pending' });
        await logAction("VERIFICATION_SUBMIT", "Verification", `User ${req.user.username} submitted identity verification.`, req.user.username);
        if (process.env.ADMIN_EMAIL) await sendEmail(process.env.ADMIN_EMAIL, "Identity Verification Request", `<p>User <strong>${fullName}</strong> requested verification.</p>`);
        res.status(201).json({ message: "Submitted.", request: reqVer });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

router.get("/verification/status", authMiddleware, residentOrHigher, async (req, res) => {
    try {
        const latest = await Verification.findOne({ userId: req.user.id }).sort({ submittedAt: -1 });
        if (!latest) return res.json({ status: 'None', message: "No request." });
        res.json({ status: latest.status, message: `Status: ${latest.status}`, details: { submittedAt: latest.submittedAt, validIdType: latest.validIdType } });
    } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

// Resident Dashboard Data
router.get("/resident/dashboard-data", authMiddleware, residentOrHigher, async (req, res) => {
    try { res.json({ blotterCount: await BlotterCase.countDocuments({ status: "Active" }), certificatesCount: await Certificate.countDocuments() }); } catch (err) { res.status(500).json({ message: "Failed", error: err.message }); }
});

export default router;