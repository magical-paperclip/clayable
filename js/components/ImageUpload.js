export class ImageUpload {
    constructor(id) {
        this.container = document.getElementById(id);
        this.input = null;
        this.preview = null;
        this.btn = null;
        this.img = null;
        
        this.init();
    }
    
    init() {
        this.createUI();
        this.setupEvents();
    }
    
    createUI() {
        let wrapper = document.createElement('div');
        wrapper.className = 'upload-wrapper';
        
        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.accept = 'image/*';
        this.input.style.display = 'none';
        
        this.btn = document.createElement('button');
        this.btn.textContent = 'Upload Image';
        this.btn.className = 'upload-btn';
        
        this.preview = document.createElement('img');
        this.preview.className = 'preview-img';
        this.preview.style.display = 'none';
        
        wrapper.appendChild(this.input);
        wrapper.appendChild(this.btn);
        wrapper.appendChild(this.preview);
        
        this.container.appendChild(wrapper);
    }
    
    setupEvents() {
        this.btn.onclick = () => this.input.click();
        this.input.onchange = (e) => this.handleFile(e);
    }
    
    handleFile(e) {
        let file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        let reader = new FileReader();
        reader.onload = (e) => this.showPreview(e.target.result);
        reader.readAsDataURL(file);
    }
    
    showPreview(src) {
        this.preview.src = src;
        this.preview.style.display = 'block';
        this.img = src;
        
        this.btn.textContent = 'Change Image';
    }
    
    getData() {
        return this.img;
    }
    
    clear() {
        this.preview.style.display = 'none';
        this.preview.src = '';
        this.img = null;
        this.btn.textContent = 'Upload Image';
        this.input.value = '';
    }
} 