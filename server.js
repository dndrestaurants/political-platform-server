const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Initialize SQLite Database
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) console.error("Error opening database:", err);
  else {
    // ✅ Create posts table
    db.run(
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        heading TEXT NOT NULL, 
        audio TEXT, 
        sources TEXT, 
        links TEXT
      )`
    );

    // ✅ Create profiles table
    db.run(
      `CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        occupation TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        state TEXT,
        country TEXT
      )`
    );
  }
});

// ✅ Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ✅ API Route to Save or Update Profile
app.post("/api/profile", (req, res) => {
  const { fullName, occupation, phone, address, state, country } = req.body;

  if (!fullName || !occupation) {
    return res.status(400).json({ message: "Full Name and Occupation are required!" });
  }

  db.run(
    `INSERT INTO profiles (fullName, occupation, phone, address, state, country)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       fullName = ?, 
       occupation = ?, 
       phone = ?, 
       address = ?, 
       state = ?, 
       country = ?`,
    [fullName, occupation, phone, address, state, country, fullName, occupation, phone, address, state, country],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Profile saved successfully!" });
    }
  );
});

// ✅ API Route to Fetch Profile
app.get("/api/profile", (req, res) => {
  db.get("SELECT * FROM profiles ORDER BY id DESC LIMIT 1", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { fullName: "", occupation: "", phone: "", address: "", state: "", country: "" });
  });
});

// ✅ API Route to Handle Post Submissions
app.post("/api/posts", upload.fields([{ name: "audio" }, { name: "sources" }]), (req, res) => {
  const { heading, links } = req.body;
  const audioPath = req.files["audio"] ? `/uploads/${req.files["audio"][0].filename}` : null;
  const sourcesPaths = req.files["sources"] ? req.files["sources"].map((file) => `/uploads/${file.filename}`).join(",") : null;

  if (!heading) {
    return res.status(400).json({ message: "Post heading is required!" });
  }

  db.run(
    "INSERT INTO posts (heading, audio, sources, links) VALUES (?, ?, ?, ?)", 
    [heading, audioPath, sourcesPaths, links], 
    function (err) {
      if (err) {
        console.error("Error inserting post:", err);
        return res.status(500).json({ message: "Error saving post" });
      }
      res.json({ message: "Post published successfully!" });
  });
});

// ✅ API Route to Fetch Posts
app.get("/api/posts", (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      console.error("Error fetching posts:", err);
      return res.status(500).json({ message: "Error fetching posts" });
    }
    res.json(rows);
  });
});

// ✅ API Route to Delete a Post
app.delete("/api/posts/:id", (req, res) => {
  const postId = req.params.id;

  db.run("DELETE FROM posts WHERE id = ?", [postId], (err) => {
    if (err) {
      console.error("Error deleting post:", err);
      return res.status(500).json({ message: "Failed to delete post" });
    }
    res.json({ message: "Post deleted successfully!" });
  });
});

// ✅ Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
