require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

// ==========================
// SUPABASE
// ==========================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

// ==========================
// MULTER
// ==========================

// La foto queda temporalmente en memoria.
// Después la mandamos a Supabase.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB máximo
  },
});

// ==========================
// OBTENER FOTOS
// ==========================

app.get("/images", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from("fotos").list("", {
      limit: 1000,
      sortBy: {
        column: "created_at",
        order: "desc",
      },
    });

    if (error) {
      console.error("Error obteniendo fotos:", error);
      return res.json([]);
    }

    const images = data
      .filter((file) => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      })
      .map((file) => {
        const { data } = supabase.storage.from("fotos").getPublicUrl(file.name);

        return data.publicUrl;
      });

    res.json(images);
  } catch (error) {
    console.error("Error:", error);
    res.json([]);
  }
});

// ==========================
// PÁGINA PRINCIPAL
// ==========================

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ==========================
// SUBIR FOTO
// ==========================

app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No se recibió ninguna foto");
    }

    const extension = req.file.originalname.split(".").pop().toLowerCase();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}.${extension}`;

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Error subiendo a Supabase:", error);
      return res.status(500).send("No se pudo subir la foto");
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);

    const imageUrl = data.publicUrl;

    console.log("Foto subida:", imageUrl);

    // Avisamos a todos los monitores conectados
    io.emit("new-image", imageUrl);

    res.send(`
      <h2>Foto subida correctamente ✅</h2>
    `);
  } catch (error) {
    console.error("Error en /upload:", error);
    res.status(500).send("No se pudo subir la foto");
  }
});

// ==========================
// SOCKET.IO
// ==========================

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// ==========================
// SERVIDOR
// ==========================

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor con Socket.io corriendo en puerto ${PORT}`);
});
