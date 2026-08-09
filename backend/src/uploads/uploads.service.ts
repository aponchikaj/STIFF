import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly cloudinaryEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    this.cloudinaryEnabled = Boolean(cloudName && apiKey && apiSecret);

    if (this.cloudinaryEnabled) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.logger.log(`Uploads go to Cloudinary (${cloudName})`);
    } else {
      this.logger.warn(
        'CLOUDINARY_* not fully set — uploads stored on local disk',
      );
    }
  }

  /** Stores the image and returns its public URL. */
  async store(file: Express.Multer.File): Promise<string> {
    if (this.cloudinaryEnabled) {
      return new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'stiff', resource_type: 'image' },
          (error, result) => {
            if (error || !result) {
              this.logger.error(
                `Cloudinary upload failed: ${error?.message ?? 'no result'}`,
              );
              reject(new InternalServerErrorException('Image upload failed'));
              return;
            }
            resolve(result.secure_url);
          },
        );
        stream.end(file.buffer);
      });
    }

    // Local fallback: keep working without Cloudinary credentials.
    const ext = extname(file.originalname).toLowerCase();
    const name = `${randomBytes(16).toString('hex')}${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(join(UPLOAD_DIR, name), file.buffer);
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:4000';
    return `${appUrl}/uploads/${name}`;
  }
}
