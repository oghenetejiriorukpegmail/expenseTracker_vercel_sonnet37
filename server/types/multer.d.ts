declare module 'multer' {
  import { Request, RequestHandler } from 'express';
  import { StorageEngine } from 'multer';

  namespace multer {
    interface File {
      /** Field name specified in the form */
      fieldname: string;
      /** Name of the file on the user's computer */
      originalname: string;
      /** Encoding type of the file */
      encoding: string;
      /** Mime type of the file */
      mimetype: string;
      /** Size of the file in bytes */
      size: number;
      /** The folder to which the file has been saved */
      destination: string;
      /** The name of the file within the destination */
      filename: string;
      /** Location of the uploaded file */
      path: string;
      /** A Buffer of the entire file */
      buffer: Buffer;
    }

    interface Options {
      /** The destination directory for the uploaded files */
      dest?: string;
      /** The storage engine to use for uploaded files */
      storage?: StorageEngine;
      /** An object specifying the size limits of the following optional properties */
      limits?: {
        /** Max field name size (Default: 100 bytes) */
        fieldNameSize?: number;
        /** Max field value size (Default: 1MB) */
        fieldSize?: number;
        /** Max number of non-file fields (Default: Infinity) */
        fields?: number;
        /** For multipart forms, the max file size (in bytes)(Default: Infinity) */
        fileSize?: number;
        /** For multipart forms, the max number of file fields (Default: Infinity) */
        files?: number;
        /** For multipart forms, the max number of parts (fields + files)(Default: Infinity) */
        parts?: number;
        /** For multipart forms, the max number of header key=>value pairs to parse Default: 2000(same as node's http) */
        headerPairs?: number;
      };
      /** A function to control which files are uploaded */
      fileFilter?(
        req: Request,
        file: File,
        callback: (error: Error | null, acceptFile: boolean) => void
      ): void;
    }

    interface StorageEngine {
      _handleFile(
        req: Request,
        file: File,
        callback: (error?: Error | null, info?: Partial<File>) => void
      ): void;
      _removeFile(
        req: Request,
        file: File,
        callback: (error: Error | null) => void
      ): void;
    }

    interface DiskStorageOptions {
      /** A function that determines the destination path for uploaded files */
      destination?: string | ((req: Request, file: File, callback: (error: Error | null, destination: string) => void) => void);
      /** A function that determines the name of the uploaded file */
      filename?(req: Request, file: File, callback: (error: Error | null, filename: string) => void): void;
    }

    interface MemoryStorageOptions {}

    type Storage = (options?: DiskStorageOptions) => StorageEngine;
    type MemoryStorage = () => StorageEngine;
    type DiskStorage = (options?: DiskStorageOptions) => StorageEngine;

    type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
  }

  interface Multer {
    (options?: multer.Options): RequestHandler;
    /** Accept a single file with the name fieldName */
    single(fieldName: string): RequestHandler;
    /** Accept an array of files, all with the name fieldName */
    array(fieldName: string, maxCount?: number): RequestHandler;
    /** Accept a mix of files, specified by fields */
    fields(fields: { name: string; maxCount?: number }[]): RequestHandler;
    /** Accept only text fields. */
    none(): RequestHandler;
    /** Storage engines for multer */
    diskStorage(options: multer.DiskStorageOptions): multer.StorageEngine;
    /** Storage engines for multer */
    memoryStorage(): multer.StorageEngine;
  }

  const multer: Multer;

  export = multer;
}