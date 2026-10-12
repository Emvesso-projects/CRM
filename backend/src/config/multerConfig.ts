import multer from "multer";
import path from "path";
import { AppError } from "../utils/errors/appError";

const MB = 1024 * 1024;
const MAX_UPLOAD_SIZE = 5 * MB;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

const ATTACHMENT_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ATTACHMENT_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".doc",
  ".docx",
]);

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (IMAGE_MIME_TYPES.has(file.mimetype) && IMAGE_EXTENSIONS.has(extension)) {
    cb(null, true);
    return;
  }

  cb(
    AppError.validation.badRequest(
      "Only image files are allowed (jpg, jpeg, png, webp)",
    ),
  );
};

const spreadsheetFileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb,
) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    SPREADSHEET_MIME_TYPES.has(file.mimetype) &&
    SPREADSHEET_EXTENSIONS.has(extension)
  ) {
    cb(null, true);
    return;
  }

  cb(
    AppError.validation.badRequest("Only xlsx, xls, or csv files are allowed"),
  );
};

const attachmentFileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb,
) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    ATTACHMENT_MIME_TYPES.has(file.mimetype) &&
    ATTACHMENT_EXTENSIONS.has(extension)
  ) {
    cb(null, true);
    return;
  }

  cb(
    AppError.validation.badRequest(
      "Only supported image or document files are allowed (jpg, png, webp, pdf, xlsx, xls, csv, doc, docx)",
    ),
  );
};

// Memory storage keeps file buffers in RAM, avoiding disk writes
const memoryStorage = multer.memoryStorage();

export const uploadLeadProfilePicture = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
  },
  fileFilter: imageFileFilter,
});

export const uploadOrganizationAssets = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 3,
  },
  fileFilter: imageFileFilter,
});

export const uploadAuthProfileAssets = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 4,
  },
  fileFilter: imageFileFilter,
});

export const uploadLeadImportFile = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 1,
  },
  fileFilter: spreadsheetFileFilter,
});

export const uploadQuotationAttachment = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 1,
  },
  fileFilter: attachmentFileFilter,
});
