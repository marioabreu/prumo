export interface Storage {
  guardar(ficheiro: Buffer, nomeOriginal: string, mime: string): Promise<{ url: string }>;
}
