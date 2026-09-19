import { FileValidator } from '@nestjs/common';

const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.app',
  '.deb',
  '.rpm',
  '.dmg',
  '.pkg',
  '.run',
  '.bin',
  '.com',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
];

export class SafeExtensionValidator extends FileValidator<
  object,
  Express.Multer.File
> {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) return false;
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    return !DANGEROUS_EXTENSIONS.includes(ext);
  }

  buildErrorMessage(): string {
    return 'This file type is not allowed for security reasons';
  }
}
