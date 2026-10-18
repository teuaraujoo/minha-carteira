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
    expiresAt: Date;
}

export interface UpdateUserProfileInput {
    userId: string;
    name?: string;
    phone?: string;
}

export interface UserProfileOutput {
    id: string;
    username: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    capabilities: string[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
    inactivatedAt: Date | null;
    profileImage: { url: string; expiresAt: Date } | null;
}
