document.addEventListener('DOMContentLoaded', function() {
    // Obtener elementos del DOM
    const textInput = document.getElementById('text-input');
    const sendTextButton = document.getElementById('send-text');
    const imageInput = document.getElementById('image-input');
    const sendImageButton = document.getElementById('send-image');
    const imagePreview = document.getElementById('image-preview');
    const statusMessage = document.getElementById('status-message');

    // Configurar Socket.io
    const socket = io();

    // Event Listeners
    sendTextButton.addEventListener('click', sendText);
    imageInput.addEventListener('change', previewImage);
    sendImageButton.addEventListener('click', sendImage);

    // Función para enviar texto
    function sendText() {
        const text = textInput.value.trim();
        
        if (!text) {
            showStatusMessage('Por favor ingresa algún texto', 'error');
            return;
        }

        // Enviar por Socket.io para respuesta inmediata
        socket.emit('text-message', text);

        // También enviar por HTTP para respaldo
        fetch('/api/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStatusMessage('Texto enviado correctamente', 'success');
                textInput.value = '';
            } else {
                showStatusMessage('Error: ' + data.error, 'error');
            }
        })
        .catch(error => {
            showStatusMessage('Error de red: ' + error.message, 'error');
        });
    }

    // Función para previsualizar imagen
    function previewImage() {
        const file = this.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    }

    // Función para enviar imagen
    function sendImage() {
        const file = imageInput.files[0];
        
        if (!file) {
            showStatusMessage('Por favor selecciona una imagen', 'error');
            return;
        }
        
        // Mostrar indicador de carga
        showStatusMessage('Subiendo imagen...', 'info');
        
        const formData = new FormData();
        formData.append('image', file);
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStatusMessage('Imagen enviada correctamente', 'success');
                imageInput.value = '';
                imagePreview.style.display = 'none';
            } else {
                showStatusMessage('Error: ' + data.error, 'error');
            }
        })
        .catch(error => {
            showStatusMessage('Error de red: ' + error.message, 'error');
        });
    }

    // Función para mostrar mensajes de estado
    function showStatusMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.remove('hidden');
        
        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
    }
});
