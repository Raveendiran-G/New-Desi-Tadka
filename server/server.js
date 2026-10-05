require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const multer = require("multer");
const supabase = require("./supabase");

const app = express();

const PORT = process.env.PORT || 3000;

// ========================================
// IMAGE UPLOAD
// ========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 4 * 1024 * 1024 // 4 MB
    },

    fileFilter: (req, file, cb) => {

        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }

    }
});

// ========================================
// ADMIN CREDENTIALS
// ========================================
const ADMIN_USERS = [
    {
        username: process.env.ADMIN_USERNAME_1,
        password: process.env.ADMIN_PASSWORD_1
    },
    {
        username: process.env.ADMIN_USERNAME_2,
        password: process.env.ADMIN_PASSWORD_2
    }
];

// ========================================
// MIDDLEWARE
// ========================================
app.use(express.json({ limit: "10mb" }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false, // Set to true if you force HTTPS later
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

// Serve static assets (like images/videos from the public folder)
app.use(express.static(path.join(__dirname, "../public")));

// ========================================
// ADMIN AUTH MIDDLEWARE
// ========================================
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login."
    });
}

// ========================================
// ADMIN LOGIN & LOGOUT
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    const user = ADMIN_USERS.find(
        admin =>
            admin.username === username &&
            admin.password === password
    );

    if (user) {
        req.session.isAdmin = true;
        return res.json({
            success: true,
            message: "Login successful"
        });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid username or password"
    });
});

app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.json({ success: true, message: "Logged out successfully" });
    });
});

app.get("/api/admin/check", (req, res) => {
    res.json({ loggedIn: req.session && req.session.isAdmin === true });
});

// ========================================
// IMAGE UPLOAD API
// ========================================

app.post(
    "/api/upload-image",
    requireAdmin,
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "No image selected"
                });
            }

            // Create a safe unique filename
            const originalName =
                path
                    .parse(req.file.originalname)
                    .name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

            const extension =
                path.extname(req.file.originalname)
                    .toLowerCase();

            const fileName =
                `${Date.now()}-${originalName}${extension}`;

            const filePath =
                `menu/${fileName}`;


            // Upload to Supabase Storage
            const { error: uploadError } =
                await supabase.storage
                    .from("menu-images")
                    .upload(
                        filePath,
                        req.file.buffer,
                        {
                            contentType: req.file.mimetype,
                            upsert: false
                        }
                    );


            if (uploadError) {

                console.error(
                    "Supabase Storage upload error:",
                    uploadError
                );

                return res.status(500).json({
                    message: "Failed to upload image"
                });
            }


            // Get public URL
            const { data } =
                supabase.storage
                    .from("menu-images")
                    .getPublicUrl(filePath);


            return res.json({
                success: true,
                imageUrl: data.publicUrl
            });


        } catch (error) {

            console.error(
                "Image upload error:",
                error
            );

            return res.status(500).json({
                message:
                    error.message ||
                    "Image upload failed"
            });

        }

    }
);

// ========================================
// MENU API ROUTES
// ========================================
app.get("/api/menu", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("menu_items")
            .select("*")
            .order("name", { ascending: true });

        if (error) {
            console.error("Supabase GET error:", error);
            return res.status(500).json({ message: "Failed to load menu" });
        }
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});



app.post("/api/menu", requireAdmin, async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;

        if (!name || !category || price === undefined) {
            return res.status(400).json({ message: "Name, category and price are required" });
        }

        const newProduct = {
            id: Date.now().toString(),
            name: String(name).trim(),
            category: String(category).trim(),
            price: Number(price),
            description: description ? String(description).trim() : "",
            image: image ? String(image).trim() : null
        };

        if (Number.isNaN(newProduct.price)) {
            return res.status(400).json({ message: "Price must be a valid number" });
        }

        const { data, error } = await supabase
            .from("menu_items")
            .insert([newProduct])
            .select()
            .single();

        if (error) {
            console.error("Supabase INSERT error:", error);
            return res.status(500).json({ message: "Failed to add product" });
        }

        res.status(201).json({ message: "Product added successfully", product: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/menu/:id", requireAdmin, async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;

        if (!name || !category || price === undefined) {
            return res.status(400).json({ message: "Name, category and price are required" });
        }

        const updatedProduct = {
            name: String(name).trim(),
            category: String(category).trim(),
            price: Number(price),
            description: description ? String(description).trim() : "",
            image: image ? String(image).trim() : null
        };

        if (Number.isNaN(updatedProduct.price)) {
            return res.status(400).json({ message: "Price must be a valid number" });
        }

        const { data, error } = await supabase
            .from("menu_items")
            .update(updatedProduct)
            .eq("id", String(req.params.id))
            .select()
            .single();

        if (error) {
            console.error("Supabase UPDATE error:", error);
            return res.status(500).json({ message: "Failed to update product" });
        }

        res.json({ message: "Product updated successfully", product: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.delete("/api/menu/:id", requireAdmin, async (req, res) => {
    try {
        const id = String(req.params.id);
        const { data, error } = await supabase
            .from("menu_items")
            .delete()
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Supabase DELETE error:", error);
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully", product: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ========================================
// HTML PAGE ROUTES (For local dev)
// ========================================
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ========================================
// START SERVER & EXPORT
// ========================================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log("\n=================================");
        console.log(" New Desi Tadka Server Started");
        console.log("=================================\n");
        console.log(`Customer Menu: http://localhost:${PORT}`);
        console.log(`Admin Panel:   http://localhost:${PORT}/admin\n`);
    });
}

module.exports = app;