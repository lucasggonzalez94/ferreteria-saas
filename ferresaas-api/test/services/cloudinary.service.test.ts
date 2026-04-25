import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Readable } from 'stream';

const mockCloudinary = {
  config: jest.fn() as any,
  uploader: {
    upload_stream: jest.fn() as any,
    destroy: jest.fn() as any,
  },
  url: jest.fn() as any,
};

jest.mock('cloudinary', () => ({
  v2: mockCloudinary,
}));

jest.mock('@/config/env', () => ({
  env: {
    cloudinary: {
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    },
  },
}));

import { CloudinaryService } from '@/services/cloudinary.service';

describe('CloudinaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads image successfully', async () => {
    mockCloudinary.uploader.upload_stream.mockImplementation((_options: any, cb: any) => {
      cb(null, { public_id: 'img-1', secure_url: 'https://cdn/img-1', bytes: 128 });
      return {} as any;
    });
    jest.spyOn(Readable, 'from').mockReturnValue({ pipe: jest.fn() } as any);

    const file = { buffer: Buffer.from('data') } as Express.Multer.File;
    const result = (await CloudinaryService.uploadImage(file)) as any;

    expect(result.public_id).toBe('img-1');
    expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'ferreteria/products', resource_type: 'auto' }),
      expect.any(Function)
    );
  });

  it('rejects when image upload fails', async () => {
    mockCloudinary.uploader.upload_stream.mockImplementation((_options: any, cb: any) => {
      cb(new Error('upload failed'));
      return {} as any;
    });
    jest.spyOn(Readable, 'from').mockReturnValue({ pipe: jest.fn() } as any);

    const file = { buffer: Buffer.from('data') } as Express.Multer.File;

    await expect(CloudinaryService.uploadImage(file)).rejects.toThrow('upload failed');
  });

  it('uploads PDF buffer as raw format', async () => {
    mockCloudinary.uploader.upload_stream.mockImplementation((options: any, cb: any) => {
      cb(null, { public_id: options.public_id, format: 'pdf' });
      return {} as any;
    });
    jest.spyOn(Readable, 'from').mockReturnValue({ pipe: jest.fn() } as any);

    const result = (await CloudinaryService.uploadPdfBuffer(
      Buffer.from('pdf-data'),
      'invoice-1'
    )) as any;

    expect(result.public_id).toBe('invoice-1');
    expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ resource_type: 'raw', format: 'pdf' }),
      expect.any(Function)
    );
  });

  it('builds attachment folder and delegates upload', async () => {
    const uploadSpy = jest
      .spyOn(CloudinaryService, 'uploadImage')
      .mockResolvedValue({ public_id: 'att-1' } as any);

    const file = { buffer: Buffer.from('data') } as Express.Multer.File;
    await CloudinaryService.uploadAttachment(file, 'biz-1', 'purchase-1');

    expect(uploadSpy).toHaveBeenCalledWith(file, 'ferreteria/purchases/biz-1/purchase-1');
  });

  it('deletes image and returns provider response', async () => {
    mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

    const result = await CloudinaryService.deleteImage('public-id-1');

    expect(result).toEqual({ result: 'ok' });
    expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('public-id-1');
  });

  it('propagates delete errors', async () => {
    mockCloudinary.uploader.destroy.mockRejectedValue(new Error('delete failed'));

    await expect(CloudinaryService.deleteImage('public-id-2')).rejects.toThrow('delete failed');
  });

  it('generates optimized url with defaults and overrides', () => {
    mockCloudinary.url.mockReturnValue('https://cdn/optimized');

    const result = CloudinaryService.getOptimizedUrl('img-2', { width: 600 });

    expect(result).toBe('https://cdn/optimized');
    expect(mockCloudinary.url).toHaveBeenCalledWith(
      'img-2',
      expect.objectContaining({ quality: 'auto', fetch_format: 'auto', width: 600 })
    );
  });
});
