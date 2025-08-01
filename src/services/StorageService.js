const fs = require('fs');
const path = require('path');

class StorageService {
  constructor() {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.resolve(__dirname, '../../public/uploads/images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  writeFile(file, meta) {
    const filename = +new Date() + meta.filename;
    const filePath = path.resolve(__dirname, '../../public/uploads/images', filename);

    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error('File write error:', error);
        reject(error);
      });
      
      fileStream.on('finish', () => {
        resolve(filename);
      });

      // Handle different types of file inputs
      if (file.pipe) {
        // If it's a readable stream
        file.pipe(fileStream);
      } else if (file._data) {
        // If it's buffer data
        fileStream.write(file._data);
        fileStream.end();
      } else {
        reject(new Error('Invalid file format'));
      }
    });
  }
}

module.exports = StorageService;
