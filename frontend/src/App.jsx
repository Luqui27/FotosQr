import "./App.css";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SERVER_IP = "192.168.100.4";
const SERVER_URL = `http://${SERVER_IP}:3000`;

const socket = io(SERVER_URL);

const IMAGE_DURATION = 5000;

function App() {
  const uploadUrl = SERVER_URL;

  // Todas las imágenes
  // Siempre: más nueva → más antigua
  const [images, setImages] = useState([]);

  // Imagen actualmente mostrada
  const [currentImage, setCurrentImage] = useState(null);

  // Indica si llegó alguna foto nueva mientras
  // se estaba mostrando la imagen actual
  const hasNewImages = useRef(false);

  // --------------------------------------------------
  // CARGAR IMÁGENES EXISTENTES
  // --------------------------------------------------

  useEffect(() => {
    const loadExistingImages = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/images`);
        const data = await response.json();

        // Más nueva → más antigua
        data.sort((a, b) => {
          const fileA = a.split("/").pop();
          const fileB = b.split("/").pop();

          return fileB.localeCompare(fileA);
        });

        setImages(data);

        // Comenzar desde la más nueva
        if (data.length > 0) {
          setCurrentImage(data[0]);
        }
      } catch (error) {
        console.error("Error cargando imágenes:", error);
      }
    };

    loadExistingImages();
  }, []);

  // --------------------------------------------------
  // RECIBIR NUEVAS IMÁGENES
  // --------------------------------------------------

  useEffect(() => {
    socket.on("new-image", (imageUrl) => {
      console.log("Nueva imagen:", imageUrl);

      // Agregamos la nueva imagen al principio
      setImages((prev) => {
        return [imageUrl, ...prev];
      });

      // Marcamos que hay que reiniciar el loop
      // cuando termine la imagen actual
      hasNewImages.current = true;
    });

    return () => {
      socket.off("new-image");
    };
  }, []);

  // --------------------------------------------------
  // REPRODUCTOR
  // --------------------------------------------------

  useEffect(() => {
    if (!currentImage) {
      return;
    }

    const timer = setTimeout(() => {
      // ----------------------------------------------
      // LLEGÓ UNA FOTO NUEVA
      // ----------------------------------------------

      if (hasNewImages.current) {
        setImages((currentImages) => {
          if (currentImages.length > 0) {
            // Reiniciamos desde la más nueva
            setCurrentImage(currentImages[0]);
          }

          return currentImages;
        });

        // Ya procesamos las nuevas fotos
        hasNewImages.current = false;

        return;
      }

      // ----------------------------------------------
      // LOOP NORMAL
      // ----------------------------------------------

      setImages((currentImages) => {
        if (currentImages.length === 0) {
          setCurrentImage(null);
          return currentImages;
        }

        // Buscar la foto actual
        const currentIndex = currentImages.indexOf(currentImage);

        let nextIndex;

        if (currentIndex === -1) {
          // Si no encontramos la actual,
          // empezamos desde la más nueva
          nextIndex = 0;
        } else {
          // Siguiente foto
          nextIndex = (currentIndex + 1) % currentImages.length;
        }

        setCurrentImage(currentImages[nextIndex]);

        return currentImages;
      });
    }, IMAGE_DURATION);

    return () => {
      clearTimeout(timer);
    };
  }, [currentImage]);

  // --------------------------------------------------
  // INTERFAZ
  // --------------------------------------------------

  return (
    <div className="event-container">
      <div className="qr-container">
        <QRCodeCanvas value={uploadUrl} size={120} />

        <p>Escaneá y enviá tu foto 📸</p>

        <small>Fotos: {images.length}</small>
      </div>

      <div className="viewer">
        {currentImage ? (
          <img
            key={currentImage}
            src={currentImage}
            alt="Foto enviada"
            className="event-image"
          />
        ) : (
          <div className="waiting">
            <h1>Esperando fotos...</h1>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
