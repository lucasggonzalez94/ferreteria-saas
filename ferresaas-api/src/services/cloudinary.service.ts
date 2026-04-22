import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export class CloudinaryService {
  /**
   * Subir archivo a Cloudinary
   */
  static async uploadImage(file: Express.Multer.File, folder: string = 'ferreteria/products') {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Image uploaded to Cloudinary:', {
              publicId: result?.public_id,
              url: result?.secure_url,
              size: result?.bytes,
            });
            resolve(result);
          }
        }
      );

      // Convertir buffer a stream y enviarlo a Cloudinary
      const bufferStream = Readable.from(file.buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  static async uploadPdfBuffer(buffer: Buffer, publicId: string, folder: string = 'ferreteria/invoices') {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'raw',
          overwrite: true,
          format: 'pdf',
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary PDF upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      const bufferStream = Readable.from(buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Subir adjunto de compra
   */
  static async uploadAttachment(
    file: Express.Multer.File,
    businessId: string,
    purchaseId: string
  ) {
    const folder = `ferreteria/purchases/${businessId}/${purchaseId}`;
    return this.uploadImage(file, folder);
  }

  /**
   * Eliminar imagen de Cloudinary
   */
  static async deleteImage(publicId: string) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('✅ Image deleted from Cloudinary:', publicId);
      return result;
    } catch (error) {
      console.error('❌ Error deleting image from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Obtener URL optimizada de imagen
   */
  static getOptimizedUrl(publicId: string, options: Record<string, any> = {}) {
    return cloudinary.url(publicId, {
      quality: 'auto',
      fetch_format: 'auto',
      ...options,
    });
  }
}
