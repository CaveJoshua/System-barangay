// types.ts

export interface Announcement {
    _id: string;
    title: string;
    description: string;
    imageUrl?: string;
    primaryTag: string;   // e.g., 'HIGH', 'MEDIUM', 'LOW'
    secondaryTag?: string; // e.g., 'Warning', 'Info'
    createdAt: string;
    // Optional fields for the "Rich" modal look (if backend supports them later)
    location?: string;
    time?: string;
    organizer?: string;
}
  
export interface UserProfile {
    name: string;
}