require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const supabase = require("./supabase");
const app = express();   
const PORT = process.env.PORT || 3000;

// ========================================
// ADMIN CREDENTIALS
// ========================================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
// ========================================
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: "Login successful" });
    }

    return res.status(401).json({ success: false, message: "Invalid username or password" });
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

app.get("/api/menu/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("menu_items")
            .select("*")
            .eq("id", String(req.params.id))
            .single();

        if (error) {
            return res.status(404).json({ message: "Product not found" });
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
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/admin.html"));
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