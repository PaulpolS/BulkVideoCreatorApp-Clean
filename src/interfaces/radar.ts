export interface RadarPost {
  id: string;
  url: string;
  thumbnail: string;
  caption: string;
  type: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  postedAt: string;
}

export interface CompetitorPage {
  id: string;
  url: string;
  name: string;
  category: string;              // e.g. "รีวิว", "สอนAI", "ไลฟ์สไตล์"
  platform: 'facebook' | 'tiktok' | 'youtube' | 'instagram' | 'unknown';
  followers: number;
  followerGrowth: number;       // e.g. +1000 in a week
  engagementRate: number;       // percentage (e.g., 2.5 represents 2.5%)
  bestTimeToPost: string;       // e.g. "พุธ 18:00 - 20:00"
  topHashtags: string[];
  videoSweetSpot: string;       // e.g. "15-30 วินาที"
  lastActiveDays: number;       // days since last post
  status: 'active' | 'dead';
  lastScraped: string;          // ISO Date
  selected: boolean;            // UI state
  scanSelected: boolean;        // เลือก scan
  isOwnPage?: boolean;          // ✅ ระบุว่าเป็นเพจของเราเอง
  profilePicUrl?: string;        // URL รูปโปรไฟล์เพจ
  note?: string;                  // บันทึกรายละเอียดเพจ
  viralPosts?: RadarPost[];     // Real viral posts fetched from API
  deepResearchDate?: string;    // ISO date of last deep research
  deepResearchPostCount?: number; // จำนวนโพสต์ที่ได้จาก Deep Research
}
