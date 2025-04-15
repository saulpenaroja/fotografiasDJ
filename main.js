const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const server = express();
const port = 3000;

// Servir archivos estáticos
server.use(express.static(path.join(__dirname, 'public')));  // Ruta al directorio 'public'

// Ruta para la página principal (display.html)
server.get('/', (req, res) => {
    const displayPath = path.join(__dirname, 'public', 'display.html');  // Ajusta esto si tu archivo HTML tiene otro nombre
    res.sendFile(displayPath);
});

// Ruta para la página de carga (upload.html)
server.get('/upload', (req, res) => {
    const uploadPath = path.join(__dirname, 'public', 'upload.html');  // Asegúrate de que upload.html esté en la carpeta public
    res.sendFile(uploadPath);  // Devuelve upload.html
});

// Obtener la IP local de la máquina
const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';  // Valor predeterminado

    for (const name of Object.keys(networkInterfaces)) {
        for (const iface of networkInterfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;  // Asigna la IP local
                break;
            }
        }
    }
    return localIp;
};

// Iniciar el servidor Express
server.listen(port, () => {
    const localIp = getLocalIp();  // Obtiene la IP local
    console.log(`Servidor ejecutándose en http://${localIp}:${port}`);
});

// Crear la ventana de la aplicación de Electron
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true  // Habilitar Node.js en la ventana de la aplicación
        }
    });

    // Usamos la IP local para cargar la aplicación
    const localIp = getLocalIp();  // Obtiene la IP local
    const url = `http://${localIp}:${port}`;

    // Cargar la URL de la aplicación
    mainWindow.loadURL(url);
}

// Esta línea debe funcionar correctamente si Electron está instalado
app.whenReady().then(createWindow);  // Crea la ventana cuando Electron está listo

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
