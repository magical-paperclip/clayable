export class ImageUpload {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.fileInput = null;
        this.previewImg = null;
        this.uploadBtn = null;
        this.currentImg = null;
        
        this.init();
    }
    
    init() {
        this.createUploadInterface();
        this.setupEventHandlers();
    }
    
    createUploadInterface() {
        const wrapper = document.createElement('div');
        wrapper.className = 'upload-wrapper';
        
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        
        this.uploadBtn = document.createElement('button');
        this.uploadBtn.textContent = 'Upload Image';
        this.uploadBtn.className = 'upload-btn';
        
        this.previewImg = document.createElement('img');
        this.previewImg.className = 'preview-img';
        this.previewImg.style.display = 'none';
        
        wrapper.appendChild(this.fileInput);
        wrapper.appendChild(this.uploadBtn);
        wrapper.appendChild(this.previewImg);
        
        this.container.appendChild(wrapper);
    }
    
    setupEventHandlers() {
        this.uploadBtn.onclick = () => {
            this.fileInput.click();
        };
        
        this.fileInput.onchange = (e) => {
            this.handleFileSelect(e);
        };
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.displayPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    displayPreview(imgSrc) {
        this.previewImg.src = imgSrc;
        this.previewImg.style.display = 'block';
        this.currentImg = imgSrc;
        
        this.uploadBtn.textContent = 'Change Image';
    }
    
    getImageData() {
        return this.currentImg;
    }
    
    clearImage() {
        this.previewImg.style.display = 'none';
        this.previewImg.src = '';
        this.currentImg = null;
        this.uploadBtn.textContent = 'Upload Image';
        this.fileInput.value = '';
    }
} 