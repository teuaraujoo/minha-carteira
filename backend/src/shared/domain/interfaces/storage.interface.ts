export interface IStorageProvider {
    upload(key: string, body: Buffer, contentType: string): Promise<unknown>,
    getPresignedUrl(key: string): Promise<string>
}