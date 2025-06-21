export class ImageUpload {
    constructor(id) {
        this.cont = document.getElementById(id);
        this.input = null; this.preview = null; this.btn = null; this.img = null;
        this.setup();
    }
    
    setup() { this.makeUI(); this.addEvents(); }
    
    makeUI() {
        let wrap = document.createElement('div'); wrap.className = 'upload-wrapper';
        
        this.input = document.createElement('input');
        this.input.type = 'file'; this.input.accept = 'image/*'; this.input.style.display = 'none';
        
        this.btn = document.createElement('button');
        this.btn.textContent = 'Upload Image'; this.btn.className = 'upload-btn';
        
        this.preview = document.createElement('img');
        this.preview.className = 'preview-img'; this.preview.style.display = 'none';
        
        wrap.appendChild(this.input); wrap.appendChild(this.btn); wrap.appendChild(this.preview);
        this.cont.appendChild(wrap);
    }
    
    addEvents() {
        this.btn.onclick = () => this.input.click();
        this.input.onchange = (e) => this.handle(e);
    }
    
    handle(e) {
        let file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        let reader = new FileReader();
        reader.onload = (e) => this.show(e.target.result);
        reader.readAsDataURL(file);
    }
    
    show(src) {
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