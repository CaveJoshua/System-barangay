export interface Announcement {
    _id: string;
    title: string;
    description: string;
    imageUrl?: string;
    primaryTag: string;   // e.g., 'HIGH', 'MEDIUM', 'LOW'
    secondaryTag?: string; // e.g., 'Warning', 'Info'
    createdAt: string;
}