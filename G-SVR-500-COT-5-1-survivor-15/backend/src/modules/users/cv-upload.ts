import fs from 'fs';
import path from 'path';
import multer, { MulterError } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

// Stockage disque local, pas de service objet managé (exigence de souveraineté Vignal).
export const CV_STORAGE_DIR = path.join(__dirname, '../../../storage/cvs');
fs.mkdirSync(CV_STORAGE_DIR, { recursive: true });

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 Mo

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CV_STORAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user!.id}-${Date.now()}${ext}`);
  },
});

const multerUploadCv = multer({
  storage,
  limits: { fileSize: MAX_CV_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new ValidationError('Le CV doit être un fichier PDF'));
      return;
    }
    cb(null, true);
  },
}).single('cv');

export function uploadCv(req: Request, res: Response, next: NextFunction): void {
  multerUploadCv(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new ValidationError('Le CV dépasse la taille maximale autorisée (5 Mo)'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}
