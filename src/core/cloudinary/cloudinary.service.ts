import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'node:stream';

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export function resourceTypeForMimeType(
  mimeType: string,
): CloudinaryResourceType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))
    return 'video';
  return 'raw';
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.config.getOrThrow('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.getOrThrow('CLOUDINARY_API_KEY'),
      api_secret: this.config.getOrThrow('CLOUDINARY_API_SECRET'),
    });
  }

  upload(
    buffer: Buffer,
    folder: string,
    resourceType: CloudinaryResourceType,
    tags: string[] = [],
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, tags },
        (error, result) => {
          if (error || !result)
            return reject(error ?? new Error('Cloudinary upload failed'));
          resolve(result);
        },
      );
      Readable.from(buffer).pipe(uploadStream);
    });
  }

  destroy(publicId: string, resourceType: CloudinaryResourceType) {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
