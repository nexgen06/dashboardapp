declare module "pdfmake/build/pdfmake" {
  interface PdfDocument {
    download(filename?: string): Promise<void>;
    open(): Promise<void>;
    getBlob(): Promise<Blob>;
  }

  interface PdfMake {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    createPdf(docDefinition: Record<string, unknown>): PdfDocument;
  }

  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}
