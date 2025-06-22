// quick img upload thing

let cont = null, input = null, preview = null;

function makeUI() {
    cont = document.createElement('div');
    cont.className = 'img-upload';
    cont.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        background: rgba(0,0,0,0.8); padding: 15px; border-radius: 8px;
        display: none; min-width: 200px;
    `;
    
    let title = document.createElement('h3');
    title.textContent = 'upload texture'; title.style.margin = '0 0 10px 0'; title.style.color = '#fff';
    
    input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.width = '100%';
    
    preview = document.createElement('div');
    preview.style.cssText = 'margin-top: 10px; text-align: center;';
    
    cont.appendChild(title); cont.appendChild(input); cont.appendChild(preview);
    document.body.appendChild(cont);
    
    addEvents();
}

function addEvents() {
    if (input) input.addEventListener('change', handle);
}

function handle(e) {
    let file = e.target.files[0];
    if (!file) return;
    
    let reader = new FileReader();
    reader.onload = (e) => show(e.target.result);
    reader.readAsDataURL(file);
}

function show(src) {
    preview.innerHTML = '';
    let img = document.createElement('img');
    img.src = src; img.style.cssText = 'max-width: 150px; max-height: 150px; border-radius: 4px;';
    preview.appendChild(img);
}

function toggle() {
    if (!cont) makeUI();
    cont.style.display = cont.style.display === 'none' ? 'block' : 'none';
}

export { makeUI, toggle }; 