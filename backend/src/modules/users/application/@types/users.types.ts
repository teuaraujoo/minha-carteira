export interface UploadProfileImageInput {
    userId: string;
    image: ImageInput
}

export interface ImageInput {
    content: Buffer;
    contentType: string;
    size: number;
}

export interface UploadProfileImageResult {
    url: string;
    expiresAt?: Date;
}
