export class ImageUpload {
    constructor(container) {
        this.container = container;
        this.setupUploadButton();
    }

    setupUploadButton() {
        // Create the upload button container
        const uploadGroup = document.createElement('div');
        uploadGroup.className = 'image-upload-group';

        // Create the label that will act as our styled button
        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'upload-btn';
        uploadLabel.htmlFor = 'image-upload';
        uploadLabel.title = 'Upload Image (I)';
        uploadLabel.textContent = 'Upload';

        // Create the hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'image-upload';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        // Add event listener for file selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    return;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    return;
                }

                // Dispatch a custom event that the main application can listen for
                const event = new CustomEvent('imageUploaded', {
                    detail: { file }
                });
                document.dispatchEvent(event);

                // Reset the input to allow selecting the same file again
                fileInput.value = '';
            }
        });

        // Add elements to the DOM
        uploadGroup.appendChild(uploadLabel);
        uploadGroup.appendChild(fileInput);
        this.container.appendChild(uploadGroup);
    }
} 