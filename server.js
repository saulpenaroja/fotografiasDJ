const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
//const multer = require('multer');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const { networkInterfaces } = require('os');

// Determina si estamos en un entorno PKG
//const isPkg = typeof process.pkg !== 'undefined';

const cors = require('cors');
app.use(cors());

// Función para resolver rutas compatibles con PKG
function getPath(relativePath) {
    // Cuando se ejecuta con PKG, los archivos están en un snapshot, pero
    // necesitamos escribir en el sistema de archivos real
    if (isPkg) {
        return path.join(process.cwd(), relativePath);
    } else {
        return path.join(__dirname, relativePath);
    }
}

// Crear directorios necesarios si no existen
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Directorio para almacenar datos
const dataDir = getPath('data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Directorio creado: ${dataDir}`);
}

const slidesFile = path.join(dataDir, 'slides.json');

// Configurar almacenamiento para imágenes
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: function (req, file, cb) {
        cb(null, 'image-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage
}).single('image');

// Servir archivos estáticos
app.use(express.static(isPkg ? getPath('public') : 'public'));
app.use(express.json());

// Almacenamiento de slides y álbumes
let slides = [];
let currentSlideIndex = 0;
let albums = [];

// Cargar datos guardados
function saveSlides() {
    try {
        fs.writeFileSync(slidesFile, JSON.stringify(slides, null, 2), 'utf8');
    } catch (err) {
        console.error('Error al guardar slides:', err);
    }
}

// Encontrar la IP local
const nets = networkInterfaces();
let localIP = '';

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            localIP = net.address;
        }
    }
}

// Cargar datos al iniciar
function loadSlides() {
    try {
        const data = fs.readFileSync(slidesFile, 'utf8');
        slides = JSON.parse(data);
        currentSlideIndex = slides.length > 0 ? slides.length - 1 : 0;
    } catch (err) {
        console.error('Error al cargar slides:', err);
    }
}

// Ruta para la página principal (PC)
app.get('/', (req, res) => {
    const uploadUrl = `http://${localIP}:3000/upload`;
    // ¡IMPORTANTE! Devolver la página principal
    const displayPath = isPkg 
    ? path.join(getPath('public'), 'display.html')
    : path.join(__dirname, 'public', 'display.html');
    
    res.sendFile(displayPath);
});

// Ruta para la página de carga (celular)
app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// Servir archivos estáticos para la carga de imágenes y Socket.IO
app.use(express.static(path.join(__dirname, 'public'))); 

// API para obtener estado actual
app.get('/api/slides', (req, res) => {
    res.json({
        slides,
        currentSlideIndex,
        totalSlides: slides.length
    });
});

// Recibir texto
app.post('/api/text', (req, res) => {
    const text = req.body.text;

    if (!text) {
        return res.status(400).json({ error: 'No se proporcionó texto' });
    }

    const newSlide = {
        id: Date.now().toString(),
        type: 'text',
        content: text,
        timestamp: new Date()
    };

    // Agregar a la colección global
    slides.push(newSlide);
    currentSlideIndex = slides.length - 1;
    saveSlides();

    io.emit('content-update', {
        type: 'text',
        content: text,
        slideIndex: currentSlideIndex,
        totalSlides: slides.length
    });

    res.json({ success: true });
});

// Recibir imágenes
app.post('/api/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.json({ error: err.message });
        }

        if (!req.file) {
            return res.json({ error: 'No se subió ningún archivo' });
        }
        
        const newSlide = {
            id: Date.now().toString(),
            type: 'image',
            content: '/uploads/' + req.file.filename,
            timestamp: new Date()
        };

        // Agregar a la colección global
        slides.push(newSlide);
        currentSlideIndex = slides.length - 1;
        saveSlides();

        io.emit('content-update', {
            type: 'image',
            content: newSlide.content,
            slideIndex: currentSlideIndex,
            totalSlides: slides.length
        });

        res.json({ success: true, filePath: newSlide.content });
    });
});

// API para navegar entre diapositivas
app.post('/api/navigate', (req, res) => {
    const { action } = req.body;

    let newIndex = currentSlideIndex;
    const totalSlides = slides.length;

    if (action === 'next' && newIndex < totalSlides - 1) {
        newIndex++;
    } else if (action === 'prev' && newIndex > 0) {
        newIndex--;
    } else if (action === 'first') {
        newIndex = 0;
    } else if (action === 'last') {
        newIndex = totalSlides - 1;
    } else if (action === 'goto' && req.body.index >= 0 && req.body.index < totalSlides) {
        newIndex = parseInt(req.body.index);
    }

    if (newIndex !== currentSlideIndex && slides.length > 0) {
        currentSlideIndex = newIndex;
        const currentSlide = slides[currentSlideIndex];

        io.emit('slide-change', {
            type: currentSlide.type,
            content: currentSlide.content,
            slideIndex: currentSlideIndex,
            totalSlides
        });
    }

    res.json({
        success: true,
        currentSlideIndex,
        totalSlides
    });
});

// API para eliminar una diapositiva
app.delete('/api/slide/:index', (req, res) => {
    const slideIndex = parseInt(req.params.index);

    if (slideIndex < 0 || slideIndex >= slides.length) {
        return res.status(400).json({ error: 'Índice de diapositiva inválido' });
    }

    // Eliminar la diapositiva
    const removedSlide = slides.splice(slideIndex, 1)[0];
    saveSlides();

    // Ajustar el índice actual si es necesario
    if (currentSlideIndex >= slides.length) {
        currentSlideIndex = Math.max(0, slides.length - 1);
    }

    // Si era una imagen, eliminar el archivo
    if (removedSlide.type === 'image') {
        const filePath = path.join(__dirname, 'public', removedSlide.content);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    // Notificar a todos los clientes
    io.emit('slide-deleted', {
        slideIndex,
        currentSlideIndex,
        totalSlides: slides.length
    });

    // Si todavía hay diapositivas, enviar la actual
    if (slides.length > 0) {
        const currentSlide = slides[currentSlideIndex];
        io.emit('slide-change', {
            type: currentSlide.type,
            content: currentSlide.content,
            slideIndex: currentSlideIndex,
            totalSlides: slides.length
        });
    } else {
        // Si no hay diapositivas, enviar contenido vacío
        io.emit('content-update', {
            type: 'empty',
            content: 'No hay contenido disponible',
            slideIndex: 0,
            totalSlides: 0
        });
    }

    res.json({ success: true });
});

// Manejar conexiones de socket
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Enviar el contenido actual cuando un usuario se conecta
    if (slides.length > 0) {
        const currentSlide = slides[currentSlideIndex];
        socket.emit('slide-change', {
            type: currentSlide.type,
            content: currentSlide.content,
            slideIndex: currentSlideIndex,
            totalSlides: slides.length
        });
    } else {
        socket.emit('content-update', {
            type: 'empty',
            content: 'No hay contenido disponible',
            slideIndex: 0,
            totalSlides: 0
        });
    }

    // Manejar mensajes de texto directamente por socket
    socket.on('text-message', (text) => {
        if (text && text.trim()) {
            const newSlide = {
                id: Date.now().toString(),
                type: 'text',
                content: text,
                timestamp: new Date()
            };

            slides.push(newSlide);
            currentSlideIndex = slides.length - 1;
            saveSlides();

            io.emit('content-update', {
                type: 'text',
                content: text,
                slideIndex: currentSlideIndex,
                totalSlides: slides.length
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
    console.log(`Abrir en PC: http://localhost:${PORT}`);
    console.log(`En el celular: http://${localIP}:${PORT}/upload`);
});
