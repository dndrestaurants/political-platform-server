const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Initialize SQLite with better-sqlite3
const db = new Database("./database.sqlite");

// ✅ Create tables (once at startup)
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    heading TEXT NOT NULL, 
    audio TEXT, 
    sources TEXT, 
    links TEXT
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    occupation TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    state TEXT,
    country TEXT
  );
`);

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

// ✅ Save or Update Profile (overwrite old one)
app.post("/api/profile", (req, res) => {
  const { fullName, occupation, phone, address, state, country } = req.body;

  if (!fullName || !occupation) {
    return res.status(400).json({ message: "Full Name and Occupation are required!" });
  }

  // Delete old profile (if any) and insert new
  db.prepare("DELETE FROM profiles").run();
  db.prepare(`
    INSERT INTO profiles (fullName, occupation, phone, address, state, country)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(fullName, occupation, phone, address, state, country);

  res.json({ message: "Profile saved successfully!" });
});

// ✅ Get Latest Profile
app.get("/api/profile", (req, res) => {
  const row = db.prepare("SELECT * FROM profiles ORDER BY id DESC LIMIT 1").get();
  res.json(row || {
    fullName: "",
    occupation: "",
    phone: "",
    address: "",
    state: "",
    country: ""
  });
});

// ✅ Publish Post
app.post("/api/posts", upload.fields([{ name: "audio" }, { name: "sources" }]), (req, res) => {
  const { heading, links } = req.body;
  const audioPath = req.files["audio"] ? `/uploads/${req.files["audio"][0].filename}` : null;
  const sourcesPaths = req.files["sources"] ? req.files["sources"].map((file) => `/uploads/${file.filename}`).join(",") : null;

  if (!heading) {
    return res.status(400).json({ message: "Post heading is required!" });
  }

  try {
    db.prepare(`
      INSERT INTO posts (heading, audio, sources, links)
      VALUES (?, ?, ?, ?)
    `).run(heading, audioPath, sourcesPaths, links);

    res.json({ message: "Post published successfully!" });
  } catch (err) {
    console.error("Error saving post:", err);
    res.status(500).json({ message: "Error saving post" });
  }
});

// ✅ Get All Posts
app.get("/api/posts", (req, res) => {
  try {
    const posts = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
    res.json(posts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Error fetching posts" });
  }
});

// ✅ Delete Post by ID
app.delete("/api/posts/:id", (req, res) => {
  const postId = req.params.id;

  try {
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
    res.json({ message: "Post deleted successfully!" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
