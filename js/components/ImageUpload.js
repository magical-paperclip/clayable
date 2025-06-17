class ImageUpload {
    constructor() {
        this.setupUploadButton();
    }
    
    setupUploadButton() {
        const uploadBox = document.createElement('div');
        uploadBox.className = 'image-upload-group';
        
        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'upload-btn';
        uploadLabel.textContent = 'Drop Image Here!';
        uploadLabel.title = 'Upload a cool image to sculpt with';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        uploadLabel.appendChild(fileInput);
        uploadBox.appendChild(uploadLabel);
        document.querySelector('.controls').appendChild(uploadBox);
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (this.checkFile(file)) {
                this.processImage(file);
            }
        });
        
        uploadLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadLabel.style.transform = 'scale(1.1)';
        });
        
        uploadLabel.addEventListener('dragleave', () => {
            uploadLabel.style.transform = 'scale(1)';
        });
        
        uploadLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadLabel.style.transform = 'scale(1)';
            const file = e.dataTransfer.files[0];
            if (this.checkFile(file)) {
                this.processImage(file);
            }
        });
    }
    
    checkFile(file) {
        if (!file) return false;
        
        if (!file.type.startsWith('image/')) {
            alert('Hey! That\'s not an image. Try something with .jpg, .png, or .gif!');
            return false;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Woah there! That image is huge. Keep it under 5MB for smooth sculpting!');
            return false;
        }
        
        return true;
    }
    
    processImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const event = new CustomEvent('imageUploaded', {
                    detail: { image: img }
                });
                document.dispatchEvent(event);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

export { ImageUpload }; 