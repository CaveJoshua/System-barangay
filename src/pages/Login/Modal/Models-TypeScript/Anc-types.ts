export interface Announcement {
    _id: string;
    title: string;
    description: string;
    imageUrl?: string;
    createdAt: string;
    status: 'Active' | 'Archived';
    primaryTag: 'HIGH' | 'MEDIUM' | 'LOW';
    secondaryTag: 'Warning' | 'Success' | 'Info';
    
    // --- NEW FIELDS ---
    location?: string;
    eventTime?: string;
    organizer?: string;
    
    views?: number;
    expiresAt?: string;
}