import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { UploadsService } from './uploads.service';

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      // Memory storage: the buffer streams straight to Cloudinary untouched,
      // so quality is exactly what the admin uploaded.
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (
          !ALLOWED_EXT.includes(ext) ||
          !ALLOWED_MIME.includes(file.mimetype)
        ) {
          cb(
            new BadRequestException(
              'Only jpg, png and webp images are allowed',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadsService.store(file);
  }
}
