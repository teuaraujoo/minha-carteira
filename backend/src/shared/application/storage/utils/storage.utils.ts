
export function buildProfileImageKey(profileId: string, mimeType: string): string {
    const extension = mimeType.slice(mimeType.indexOf("/") + 1);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
        throw new TypeError("profileId deve ser um UUID.");
    }

    return `users/${profileId}/profile-image.${extension}`;
}
