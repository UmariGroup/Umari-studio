
export enum AppView {
  MARKETPLACE = 'marketplace',
  VIDEO = 'video',
  CHAT = 'chat',
  COPYWRITER = 'copywriter'
}

export interface GeneratedAsset {
  id: string;
  type: 'image';
  url: string;
  timestamp: number;
  prompt?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
}
