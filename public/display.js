document.addEventListener('DOMContentLoaded', function () {
    // Obtener elementos del DOM
    const toggleSlideshowBtn = document.getElementById('toggle-slideshow');
const transitionSelect = document.getElementById('transition-select');
const intervalSlider = document.getElementById('interval-slider');
const intervalValue = document.getElementById('interval-value');



    const contentArea = document.getElementById('content-area');
    const imageContainer = document.getElementById('image-container');
    const textContainer = document.getElementById('text-container');
    const emptyContainer = document.getElementById('empty-container');
    const prevSlideBtn = document.getElementById('prev-slide');
    const nextSlideBtn = document.getElementById('next-slide');
    const prevSlideOverlayBtn = document.getElementById('prev-slide-overlay');
    const nextSlideOverlayBtn = document.getElementById('next-slide-overlay');
    const fullscreenToggleBtn = document.getElementById('fullscreen-toggle');
    const deleteSlideBtn = document.getElementById('delete-slide');
    const gotoFirstBtn = document.getElementById('goto-first');
    const gotoLastBtn = document.getElementById('goto-last');
    const currentSlideDisplay = document.getElementById('current-slide');
    const totalSlidesDisplay = document.getElementById('total-slides');
    const thumbnailsContainer = document.getElementById('thumbnails-container');

    // Configurar Socket.io
    const socket = io();

    // Variables de estado
    let currentSlideIndex = 0;
    let totalSlides = 0;
    let slides = [];
    let isFullscreen = false;

    // Cargar datos iniciales
    fetchSlides();

    // Event Listeners para navegación
    prevSlideBtn.addEventListener('click', () => navigateSlides('prev'));
    nextSlideBtn.addEventListener('click', () => navigateSlides('next'));
    prevSlideOverlayBtn.addEventListener('click', () => navigateSlides('prev'));
    nextSlideOverlayBtn.addEventListener('click', () => navigateSlides('next'));
    deleteSlideBtn.addEventListener('click', deleteCurrentSlide);
    gotoFirstBtn.addEventListener('click', () => navigateSlides('first'));
    gotoLastBtn.addEventListener('click', () => navigateSlides('last'));

    // Event Listener para pantalla completa
    fullscreenToggleBtn.addEventListener('click', toggleFullscreen);

    // Socket events
    socket.on('content-update', handleContentUpdate);
    socket.on('slide-change', handleSlideChange);
    socket.on('slide-deleted', handleSlideDeleted);

    // Función para alternar pantalla completa
    function toggleFullscreen() {
        if (!isFullscreen) {
            // Entrar en modo pantalla completa
            if (contentArea.requestFullscreen) {
                contentArea.requestFullscreen();
            } else if (contentArea.mozRequestFullScreen) { // Firefox
                contentArea.mozRequestFullScreen();
            } else if (contentArea.webkitRequestFullscreen) { // Chrome, Safari, Opera
                contentArea.webkitRequestFullscreen();
            } else if (contentArea.msRequestFullscreen) { // IE/Edge
                contentArea.msRequestFullscreen();
            }
            fullscreenToggleBtn.textContent = "Salir de pantalla completa";
            isFullscreen = true;
        } else {
            // Salir de modo pantalla completa
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenToggleBtn.textContent = "Pantalla completa";
            isFullscreen = false;
        }
    }

    // Escuchar eventos de cambio de pantalla completa
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener('mozfullscreenchange', updateFullscreenState);
    document.addEventListener('MSFullscreenChange', updateFullscreenState);

    function updateFullscreenState() {
        isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);

        fullscreenToggleBtn.textContent = isFullscreen ? "Salir de pantalla completa" : "Pantalla completa";
    }

    // Función para obtener slides
    function fetchSlides() {
        fetch('/api/slides')
            .then(response => response.json())
            .then(data => {
                slides = data.slides;
                currentSlideIndex = data.currentSlideIndex;
                totalSlides = data.totalSlides;

                // Actualizar UI
                updateSlideIndicator();
                renderThumbnails();

                // Mostrar la diapositiva actual si existe
                if (totalSlides > 0) {
                    showSlide(currentSlideIndex);
                } else {
                    showEmptyState();
                }

                // Actualizar visibilidad de los controles de overlay
                updateOverlayControlsVisibility();
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    // Función para actualizar la visibilidad de los controles superpuestos
    function updateOverlayControlsVisibility() {
        const overlayControls = document.querySelector('.overlay-controls');
        const currentSlide = slides[currentSlideIndex];

        if (totalSlides > 0 && currentSlide && currentSlide.type === 'image') {
            overlayControls.style.display = 'flex';
        } else {
            overlayControls.style.display = 'none';
        }
    }

    // Función para navegar entre diapositivas
    function navigateSlides(action) {
        fetch('/api/navigate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    currentSlideIndex = data.currentSlideIndex;
                    totalSlides = data.totalSlides;
                    updateSlideIndicator();
                }
            })
            .catch(error => {
                console.error('Error al navegar:', error);
            });
    }

    // Función para eliminar la diapositiva actual
    function deleteCurrentSlide() {
        if (totalSlides === 0) return;

        if (confirm('¿Estás seguro de que deseas eliminar esta diapositiva?')) {
            fetch(`/api/slide/${currentSlideIndex}`, {
                method: 'DELETE',
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('Diapositiva eliminada correctamente');
                    }
                })
                .catch(error => {
                    console.error('Error al eliminar la diapositiva:', error);
                });
        }
    }

    // Función para manejar actualizaciones de contenido
    function handleContentUpdate(data) {
        if (data.type === 'empty') {
            showEmptyState();
            return;
        }

        // Actualizar el estado
        fetchSlides();

        // Mostrar el contenido
        //showContent(data.type, data.content);
    }

    // Función para manejar cambios de diapositiva
    function handleSlideChange(data) {
        currentSlideIndex = data.slideIndex;
        totalSlides = data.totalSlides;

        // Actualizar UI
        updateSlideIndicator();
        highlightCurrentThumbnail();
        showContent(data.type, data.content);
        updateOverlayControlsVisibility();
    }

    // Función para manejar la eliminación de diapositivas
    function handleSlideDeleted(data) {
        // Actualizar el estado
        fetchSlides();
    }

    // Función para mostrar una diapositiva específica
    function showSlide(index) {
        if (slides.length === 0) {
            showEmptyState();
            return;
        }

        const slide = slides[index];
        showContent(slide.type, slide.content);
        highlightCurrentThumbnail();
        updateOverlayControlsVisibility();
    }

    // Función para mostrar contenido basado en su tipo
    function showContent(type, content) {
        // Ocultar todos los contenedores
        imageContainer.style.display = 'none';
        textContainer.style.display = 'none';
        emptyContainer.style.display = 'none';
        
        if (type === 'image') {
            // Mostrar imagen con marca de agua superpuesta
            imageContainer.innerHTML = `
                <div class="image-wrapper">
                    <img src="${content}" class="displayed-image" alt="Imagen compartida">
                    <img id="watermark" src="/diego-logo.png" alt="Diego Logo">
                </div>
            `;
            imageContainer.style.display = 'flex';
        } else if (type === 'text') {
            // Mostrar texto
            textContainer.innerHTML = `<p>${content}</p>`;
            textContainer.style.display = 'flex';
        } else {
            // Mostrar estado vacío
            showEmptyState();
        }
    }

    // Función para mostrar el estado vacío
    function showEmptyState() {
        imageContainer.style.display = 'none';
        textContainer.style.display = 'none';
        emptyContainer.style.display = 'flex';
        updateOverlayControlsVisibility();
    }

    // Función para actualizar el indicador de diapositivas
    function updateSlideIndicator() {
        currentSlideDisplay.textContent = totalSlides > 0 ? currentSlideIndex + 1 : 0;
        totalSlidesDisplay.textContent = totalSlides;

        // Habilitar/deshabilitar botones de navegación
        prevSlideBtn.disabled = currentSlideIndex === 0 || totalSlides === 0;
        nextSlideBtn.disabled = currentSlideIndex === totalSlides - 1 || totalSlides === 0;
        prevSlideOverlayBtn.disabled = currentSlideIndex === 0 || totalSlides === 0;
        nextSlideOverlayBtn.disabled = currentSlideIndex === totalSlides - 1 || totalSlides === 0;
        deleteSlideBtn.disabled = totalSlides === 0;
    }

    // Función para renderizar miniaturas
    function renderThumbnails() {
        thumbnailsContainer.innerHTML = '';

        slides.forEach((slide, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.dataset.index = index;

            if (slide.type === 'image') {
                thumbnail.innerHTML = `<img src="${slide.content}" alt="Miniatura ${index + 1}">`;
            } else {
                thumbnail.innerHTML = `<div class="text-thumbnail">${slide.content.substring(0, 20)}...</div>`;
            }

            if (index === currentSlideIndex) {
                thumbnail.classList.add('active');
            }

            thumbnail.addEventListener('click', () => {
                navigateSlides('goto', index);
            });

            thumbnailsContainer.appendChild(thumbnail);
        });
    }

    // Función para resaltar la miniatura actual
    function highlightCurrentThumbnail() {
        const thumbnails = document.querySelectorAll('.thumbnail');
        thumbnails.forEach((thumbnail, index) => {
            if (index === currentSlideIndex) {
                thumbnail.classList.add('active');
            } else {
                thumbnail.classList.remove('active');
            }
        });
    }


    // Añade este código después de los otros event listeners en display.js

// Event Listener para navegación con teclado
document.addEventListener('keydown', handleKeyNavigation);

// Función para manejar navegación con teclado
function handleKeyNavigation(event) {
    // Prevenir comportamiento predeterminado solo para las teclas que nos interesan
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
        event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
    }
    
    // Navegación con teclas de flecha
    switch (event.key) {
        case 'ArrowLeft':
            // Flecha izquierda -> diapositiva anterior
            if (!prevSlideBtn.disabled) {
                navigateSlides('prev');
            }
            break;
        case 'ArrowRight':
            // Flecha derecha -> diapositiva siguiente
            if (!nextSlideBtn.disabled) {
                navigateSlides('next');
            }
            break;
        case 'Home':
            // Tecla Home -> primera diapositiva
            navigateSlides('first');
            break;
        case 'End':
            // Tecla End -> última diapositiva
            navigateSlides('last');
            break;
        case 'f':
        case 'F':
            // Tecla F -> alternar pantalla completa
            toggleFullscreen();
            break;
        case 'Delete':
        case 'Backspace':
            // Tecla Delete o Backspace -> eliminar diapositiva (con confirmación)
            if (!deleteSlideBtn.disabled && event.ctrlKey) {
                deleteCurrentSlide();
            }
            break;
    }
}

// Función para mostrar una indicación visual de navegación con teclado
function showKeyFeedback(direction) {
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'key-feedback';
    feedbackElement.innerHTML = direction === 'prev' ? '&lt;' : '&gt;';
    
    document.body.appendChild(feedbackElement);
    
    // Animación para fade-out
    setTimeout(() => {
        feedbackElement.style.opacity = '0';
    }, 100);
    
    // Eliminar el elemento después de la animación
    setTimeout(() => {
        document.body.removeChild(feedbackElement);
    }, 500);
}

let slideTimer = null;
let slideInterval = 5000; // 5 segundos por defecto
let autoplayEnabled = false;
let transitionType = 'fade'; // 'fade', 'slide', 'zoom'
let priorityQueue = []; // Para nuevas imágenes

function startSlideshow() {
    if (slideTimer) clearInterval(slideTimer);
    autoplayEnabled = true;
    
    slideTimer = setInterval(() => {
      // Verificar si hay nuevas imágenes en la cola de prioridad
      if (priorityQueue.length > 0) {
        const nextSlideIndex = priorityQueue.shift();
        showSlide(nextSlideIndex);
      } else if (totalSlides > 1) {
        // Avanzar a la siguiente diapositiva
        const nextIndex = (currentSlideIndex + 1) % totalSlides;
        showSlide(nextIndex);
      }
    }, slideInterval);
  }
  
  function stopSlideshow() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
    autoplayEnabled = false;
  }
  
  function toggleSlideshow() {
    if (autoplayEnabled) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
    return autoplayEnabled;
  }


  // En la función handleContentUpdate
if (data.type === 'image' && data.isNew) {
    // Priorizar la nueva imagen
    priorityQueue.push(slides.length - 1);
    
    // Mostrar inmediatamente
    showSlide(slides.length - 1);
    
    // Asegurar que el slideshow esté activo
    if (!autoplayEnabled) {
      startSlideshow();
    }
  }




  toggleSlideshowBtn.addEventListener('click', function() {
    const isPlaying = toggleSlideshow();
    this.textContent = isPlaying ? 'Detener presentación' : 'Iniciar presentación';
    
    // Añadir/remover clase para indicar el estado
    if (isPlaying) {
        this.classList.add('active');
    } else {
        this.classList.remove('active');
    }
});

transitionSelect.addEventListener('change', function() {
    transitionType = this.value;
    // Aplicar la transición seleccionada al contenedor de imágenes
    imageContainer.className = '';
    imageContainer.classList.add(`${transitionType}-transition`);
});

intervalSlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    intervalValue.textContent = value;
    slideInterval = value * 1000; // Convertir a milisegundos
    
    // Reiniciar el slideshow si está activo para aplicar el nuevo intervalo
    if (autoplayEnabled) {
        stopSlideshow();
        startSlideshow();
    }
});

function showContent(type, content) {
    // Ocultar todos los contenedores
    imageContainer.style.display = 'none';
    textContainer.style.display = 'none';
    emptyContainer.style.display = 'none';
    
    if (type === 'image') {
        // Aplicar la clase de transición seleccionada
        imageContainer.className = `${transitionType}-transition`;
        
        // Mostrar imagen con marca de agua superpuesta
        imageContainer.innerHTML = `
            <div class="image-wrapper">
                <img src="${content}" class="displayed-image" alt="Imagen compartida">
                <img id="watermark" src="/diego-logo.png" alt="Diego Logo">
            </div>
        `;
        imageContainer.style.display = 'flex';
    } else if (type === 'text') {
        // Mostrar texto
        textContainer.innerHTML = `<p>${content}</p>`;
        textContainer.style.display = 'flex';
    } else {
        // Mostrar estado vacío
        showEmptyState();
    }
}



});