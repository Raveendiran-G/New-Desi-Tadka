require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const supabase = require("../server/supabase");

const app = express();

app.use(express.json({ limit: "10mb" }));

// ========================================
// SESSION
// ========================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

// ========================================
// ADMIN AUTH
// ========================================

function requireAdmin(req, res, next) {

    if (
        req.session &&
        req.session.isAdmin === true
    ) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Unauthorized"
    });
}

// ========================================
// LOGIN
// ========================================

app.post("/api/admin/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {

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

// ========================================
// LOGOUT
// ========================================

app.post("/api/admin/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });

    });

});

// ========================================
// CHECK LOGIN
// ========================================

app.get("/api/admin/check", (req, res) => {

    res.json({
        loggedIn:
            req.session &&
            req.session.isAdmin === true
    });

});

// ========================================
// GET MENU
// ========================================

app.get("/api/menu", async (req, res) => {

    try {

        const {
            data,
            error
        } = await supabase
            .from("menu_items")
            .select("*")
            .order("name", {
                ascending: true
            });

        if (error) {

            console.error(error);

            return res.status(500).json({
                message: "Failed to load menu"
            });

        }

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});

// ========================================
// GET ONE ITEM
// ========================================

app.get("/api/menu/:id", async (req, res) => {

    try {

        const {
            data,
            error
        } = await supabase
            .from("menu_items")
            .select("*")
            .eq("id", String(req.params.id))
            .single();

        if (error) {

            return res.status(404).json({
                message: "Product not found"
            });

        }

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});

// ========================================
// ADD ITEM
// ========================================

app.post(
    "/api/menu",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                name,
                category,
                price,
                description,
                image
            } = req.body;

            if (
                !name ||
                !category ||
                price === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Name, category and price are required"
                });

            }

            const product = {

                id: Date.now().toString(),

                name: String(name).trim(),

                category:
                    String(category).trim(),

                price: Number(price),

                description:
                    description
                        ? String(description).trim()
                        : "",

                image:
                    image
                        ? String(image).trim()
                        : null
            };

            if (Number.isNaN(product.price)) {

                return res.status(400).json({
                    message:
                        "Price must be a number"
                });

            }

            const {
                data,
                error
            } = await supabase
                .from("menu_items")
                .insert([product])
                .select()
                .single();

            if (error) {

                console.error(error);

                return res.status(500).json({
                    message:
                        "Failed to add product"
                });

            }

            res.status(201).json({
                message:
                    "Product added successfully",

                product: data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Server error"
            });

        }

    }
);

// ========================================
// UPDATE ITEM
// ========================================

app.put(
    "/api/menu/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                name,
                category,
                price,
                description,
                image
            } = req.body;

            if (
                !name ||
                !category ||
                price === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Name, category and price are required"
                });

            }

            const updates = {

                name: String(name).trim(),

                category:
                    String(category).trim(),

                price: Number(price),

                description:
                    description
                        ? String(description).trim()
                        : "",

                image:
                    image
                        ? String(image).trim()
                        : null
            };

            if (Number.isNaN(updates.price)) {

                return res.status(400).json({
                    message:
                        "Price must be a number"
                });

            }

            const {
                data,
                error
            } = await supabase
                .from("menu_items")
                .update(updates)
                .eq(
                    "id",
                    String(req.params.id)
                )
                .select()
                .single();

            if (error) {

                console.error(error);

                return res.status(500).json({
                    message:
                        "Failed to update product"
                });

            }

            res.json({
                message:
                    "Product updated successfully",

                product: data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Server error"
            });

        }

    }
);

// ========================================
// DELETE ITEM
// ========================================

app.delete(
    "/api/menu/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("menu_items")
                .delete()
                .eq(
                    "id",
                    String(req.params.id)
                )
                .select()
                .single();

            if (error) {

                console.error(error);

                return res.status(404).json({
                    message:
                        "Product not found"
                });

            }

            res.json({
                message:
                    "Product deleted successfully",

                product: data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Server error"
            });

        }

    }
);

module.exports = app;