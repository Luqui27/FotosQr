const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

const SERVER_IP = "192.168.100.4";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

app.get("/images", (req, res) => {
  const uploadPath = path.join(__dirname, "uploads");

  fs.readdir(uploadPath, (err, files) => {
    if (err) {
      return res.json([]);
    }

    const images = files
      .filter((file) => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
      })
      .map((file) => {
        return `http://${SERVER_IP}:3000/uploads/${file}`;
      });

    res.json(images);
  });
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/upload", upload.single("photo"), (req, res) => {
  const imageUrl = `http://${SERVER_IP}:3000/uploads/${req.file.filename}`;

  io.emit("new-image", imageUrl);

  res.send(`
    <h2>Foto subida correctamente ✅</h2>
  `);
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Servidor con Socket.io corriendo en puerto 3000");
});
