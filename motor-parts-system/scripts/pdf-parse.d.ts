declare module 'pdf-parse' {
  function pdfParse(
    dataBuffer: Buffer
  ): Promise<{ numpages: number; text: string; info: unknown; metadata: unknown }>;
  export = pdfParse;
}
