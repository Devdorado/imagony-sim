import { MoltbookClient } from '../clients/moltbook';
import { ImagonyClient, ImagonyAgentData } from '../clients/imagony';
import { Agent, Post } from '../types';

export interface DashboardData {
  timestamp: string;
  imagony: {
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
    history: ImagonyAgentData[];
  };
  moltbook: {
    karma: number;
    posts: number;
    comments: number;
    recentPosts: Post[];
    profile?: Agent;
  };
  bridge: {
    eventsProcessed: number;
    lastEvent: string;
    status: 'online' | 'offline';
  };
  correlation: {
    readinessKarmaRatio: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export class DashboardService {
  private moltbook: MoltbookClient;
  private imagony: ImagonyClient;
  private eventCount: number = 0;
  private lastEvent: string = '-';

  constructor(moltbookApiKey: string, imagonyAgentId?: string) {
    this.moltbook = new MoltbookClient(moltbookApiKey);
    this.imagony = new ImagonyClient(imagonyAgentId);
  }

  recordEvent(eventType: string) {
    this.eventCount++;
    this.lastEvent = eventType;
  }

  async getDashboardData(): Promise<DashboardData> {
    // Fetch data in parallel
    let imagonyData: ImagonyAgentData | null = null;
    let moltbookProfile: Agent | undefined;
    let moltbookPosts: Post[] = [];
    let imagonyHistory: ImagonyAgentData[] = [];

    try {
      imagonyData = await this.imagony.getAgentData();
    } catch (e) {
      console.error('[Dashboard] Failed to get Imagony data:', e);
    }

    try {
      moltbookProfile = await this.moltbook.getAgentProfile();
    } catch (e) {
      console.error('[Dashboard] Failed to get Moltbook profile:', e);
    }

    try {
      moltbookPosts = await this.moltbook.getMyPosts();
    } catch (e) {
      console.error('[Dashboard] Failed to get Moltbook posts:', e);
    }

    try {
      imagonyHistory = this.imagony.getFullHistory();
    } catch (e) {
      console.error('[Dashboard] Failed to get Imagony history:', e);
    }

    // Calculate correlation metrics
    const karma = moltbookProfile?.karma || 0;
    const readiness = imagonyData?.readiness || 0;
    const ratio = readiness > 0 ? karma / readiness : 0;

    // Determine trend based on history
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (imagonyHistory.length >= 2) {
      const recent = imagonyHistory.slice(-5);
      const avgReadiness = recent.reduce((sum: number, h: ImagonyAgentData) => sum + h.readiness, 0) / recent.length;
      const prevSlice = imagonyHistory.slice(-10, -5);
      const prevAvg = prevSlice.length > 0 
        ? prevSlice.reduce((sum: number, h: ImagonyAgentData) => sum + h.readiness, 0) / prevSlice.length
        : avgReadiness;
      
      if (avgReadiness > prevAvg + 5) trend = 'improving';
      else if (avgReadiness < prevAvg - 5) trend = 'declining';
    }

    return {
      timestamp: new Date().toISOString(),
      imagony: {
        position: imagonyData?.position || 21,
        readiness: imagonyData?.readiness || 67,
        questsCompleted: imagonyData?.questsCompleted || 5,
        age: imagonyData?.age || 2,
        history: imagonyHistory,
      },
      moltbook: {
        karma: karma,
        posts: moltbookPosts.length,
        comments: 0,
        recentPosts: moltbookPosts.slice(0, 5),
        profile: moltbookProfile,
      },
      bridge: {
        eventsProcessed: this.eventCount,
        lastEvent: this.lastEvent,
        status: 'online',
      },
      correlation: {
        readinessKarmaRatio: parseFloat(ratio.toFixed(2)),
        trend,
      },
    };
  }

  async updateImagonyData(data: Partial<ImagonyAgentData>): Promise<ImagonyAgentData> {
    return this.imagony.updateAgentData(data);
  }
}
